// lib/offline/sync.ts
//
// Sync engine for offline scoring.
// Two main operations:
//   1. downloadVisitForOffline(visitId) — fetches all data needed for a visit
//      and stores it in IndexedDB so it can be opened/edited offline.
//   2. syncPendingMutations() — flushes the local mutation queue to the server.
//
// Both are called manually from UI buttons. No auto-sync.

import { createClient } from "@/lib/supabase/client";
import {
  bulkPutVisits,
  bulkPutFlocks,
  bulkPutFarms,
  bulkPutScoringDefinitions,
  bulkPutVisitScores,
  bulkPutVisitFlocks,
  bulkPutPhotos,
  getPendingMutations,
  deleteMutation,
  updateMutation,
  getBlob,
  deleteBlob,
} from "./repository";
import { setMeta } from "./db";
import { upsertScore } from "@/app/(app)/scoring/actions";
import { emitPendingChanged } from "./use-online-status";

// =====================================================================
// DOWNLOAD: get visit data for offline use
// =====================================================================

export async function downloadVisitForOffline(visitId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const supabase = createClient();

    // Fetch visit with related data
    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .select(`
        id, client_id, farm_id, scheduled_at, status, bird_count, notes,
        farms(id, name),
        visit_flocks(
          flock_id,
          flocks(id, reference, placement_date, house_id,
                 breeds(name), houses(id, name))
        )
      `)
      .eq("id", visitId)
      .maybeSingle();

    if (visitError || !visit) {
      return { ok: false, error: visitError?.message ?? "Visit not found" };
    }

    // Save visit
    const farm = Array.isArray(visit.farms) ? visit.farms[0] : visit.farms;
    await bulkPutVisits([{
      id: visit.id,
      client_id: visit.client_id,
      farm_id: visit.farm_id,
      scheduled_at: visit.scheduled_at,
      status: visit.status,
      bird_count: visit.bird_count,
      notes: visit.notes,
      farm_name: farm?.name,
    }]);

    // Save farm
    if (farm) {
      await bulkPutFarms([{ id: farm.id, name: farm.name }]);
    }

    // Save flocks and visit_flocks
    const visitFlocksData = Array.isArray(visit.visit_flocks) ? visit.visit_flocks : [];
    const flocksToSave: any[] = [];
    const visitFlocksToSave: any[] = [];

    for (const vf of visitFlocksData) {
      const fl = Array.isArray(vf.flocks) ? vf.flocks[0] : vf.flocks;
      if (!fl) continue;
      const breed = Array.isArray(fl.breeds) ? fl.breeds[0] : fl.breeds;
      const house = Array.isArray(fl.houses) ? fl.houses[0] : fl.houses;

      const ageDays = Math.round(
        (Date.now() - new Date(fl.placement_date).getTime()) / 86_400_000
      );

      flocksToSave.push({
        id: fl.id,
        reference: fl.reference,
        placement_date: fl.placement_date,
        house_id: fl.house_id,
        age_days: ageDays,
        house_name: house?.name ?? "—",
        breed_name: breed?.name ?? null,
      });

      visitFlocksToSave.push({
        visit_id: visit.id,
        flock_id: fl.id,
      });
    }

    if (flocksToSave.length > 0) await bulkPutFlocks(flocksToSave);
    if (visitFlocksToSave.length > 0) await bulkPutVisitFlocks(visitFlocksToSave);

    // Save scoring definitions
    const { data: definitions } = await supabase
      .from("scoring_definitions")
      .select("id, name, scale_max, module, module_order, order_in_module, field_type");

    if (definitions && definitions.length > 0) {
      await bulkPutScoringDefinitions(
        definitions.map((d) => ({
          id: d.id,
          name: d.name,
          scale_max: d.scale_max,
          module: d.module ?? "Other",
          module_order: d.module_order ?? 0,
          order_in_module: d.order_in_module ?? 0,
          field_type: (d.field_type ?? "score") as "score" | "numeric" | "sex",
        }))
      );
    }

    // Save existing scores
    const { data: scores } = await supabase
      .from("visit_scores")
      .select(`
        id, visit_id, flock_id, bird_number, definition_id,
        score, numeric_value, text_value,
        photos(id, storage_path)
      `)
      .eq("visit_id", visitId);

    if (scores && scores.length > 0) {
      await bulkPutVisitScores(
        scores.map((s) => ({
          id: s.id,
          visit_id: s.visit_id,
          flock_id: s.flock_id,
          bird_number: s.bird_number,
          definition_id: s.definition_id,
          score: s.score,
          numeric_value: s.numeric_value,
          text_value: s.text_value,
        }))
      );

      // Save photo metadata + signed URLs
      const photosToSave: any[] = [];
      for (const s of scores) {
        const photoArr = Array.isArray(s.photos) ? s.photos : [];
        for (const p of photoArr) {
          const { data: signed } = await supabase.storage
            .from("visit-photos")
            .createSignedUrl(p.storage_path, 3600);
          photosToSave.push({
            id: p.id,
            visit_score_id: s.id,
            storage_path: p.storage_path,
            url: signed?.signedUrl ?? "",
          });
        }
      }
      if (photosToSave.length > 0) await bulkPutPhotos(photosToSave);
    }

    // Mark this visit as synced
    await setMeta(`visit_synced_${visitId}`, new Date().toISOString());

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Download failed" };
  }
}

// =====================================================================
// UPLOAD: flush pending mutations to server
// =====================================================================

export interface SyncResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

export async function syncPendingMutations(
  onProgress?: (current: number, total: number) => void
): Promise<SyncResult> {
  const mutations = await getPendingMutations();
  const result: SyncResult = {
    total: mutations.length,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  if (mutations.length === 0) return result;

  for (let i = 0; i < mutations.length; i++) {
    const mutation = mutations[i];
    if (onProgress) onProgress(i + 1, mutations.length);

    try {
      if (mutation.type === "upsert_score") {
        await flushUpsertScore(mutation.payload);
        await deleteMutation(mutation.id);
        result.succeeded++;
      } else if (mutation.type === "upload_photo") {
        await flushUploadPhoto(mutation.payload);
        await deleteMutation(mutation.id);
        result.succeeded++;
      }
    } catch (e: any) {
      result.failed++;
      result.errors.push(e?.message ?? "Unknown error");

      // Update mutation with error info
      await updateMutation({
        ...mutation,
        attempts: mutation.attempts + 1,
        last_error: e?.message ?? "Unknown error",
      });
    }
  }

  emitPendingChanged();
  return result;
}

async function flushUpsertScore(payload: any): Promise<void> {
  const result = await upsertScore({
    visitId: payload.visitId,
    flockId: payload.flockId,
    birdNumber: payload.birdNumber,
    definitionId: payload.definitionId,
    fieldType: payload.fieldType,
    scoreValue: payload.scoreValue,
    numericValue: payload.numericValue,
    textValue: payload.textValue,
  });
  if (!result.ok) {
    throw new Error(result.error ?? "Server upsert failed");
  }
}

async function flushUploadPhoto(payload: any): Promise<void> {
  const supabase = createClient();

  // Get the current user for uploaded_by
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated — cannot upload photo");
  }

  const blobRow = await getBlob(payload.blobId);
  if (!blobRow) {
    // Blob already deleted means upload succeeded earlier and the mutation
    // was orphaned. Just succeed so the queue can clear it.
    console.warn(`[sync] Blob ${payload.blobId} not found, treating as already uploaded`);
    return;
  }

  // CRITICAL: path MUST start with visit_id (not visit_score_id) because
  // the RLS policy on storage.objects checks foldername[1] = visit_id
  if (!payload.visitId) {
    throw new Error(
      `Photo mutation missing visitId in payload (got ${JSON.stringify(payload)}). ` +
      `Old mutations queued before the fix won't have it — clear pending changes and retry.`
    );
  }

  const ext = blobRow.mime_type.includes("png") ? "png" : "jpg";
  const path = `${payload.visitId}/${payload.photoId}.${ext}`;

  console.log(`[sync] Uploading photo to ${path}`);

  const { error: uploadError } = await supabase.storage
    .from("visit-photos")
    .upload(path, blobRow.blob, {
      contentType: blobRow.mime_type,
      upsert: true,
    });

  if (uploadError) {
    console.error(`[sync] Storage upload failed:`, uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // Insert photo row in database
  const { error: insertError } = await supabase
    .from("photos")
    .insert({
      visit_score_id: payload.visitScoreId,
      storage_path: path,
      uploaded_by: user.id,
    });

  if (insertError) {
    console.error(`[sync] Photo metadata insert failed:`, insertError);
    // Try to clean up the orphaned storage object so we don't leave garbage
    await supabase.storage.from("visit-photos").remove([path]).catch(() => {});
    throw new Error(`Photo metadata insert failed: ${insertError.message}`);
  }

  console.log(`[sync] Photo uploaded successfully: ${path}`);

  // Cleanup local blob
  await deleteBlob(payload.blobId);
}
