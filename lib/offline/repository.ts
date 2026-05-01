// lib/offline/repository.ts
//
// High-level data accessors for offline-first reads and writes.
// Components call these instead of Supabase directly.

import {
  STORES,
  idbGet,
  idbGetAll,
  idbGetByIndex,
  idbPut,
  idbPutMany,
  idbDelete,
  generateLocalId,
  type OfflineVisit,
  type OfflineFlock,
  type OfflineScoringDefinition,
  type OfflineVisitScore,
  type OfflineVisitFlock,
  type OfflineFarm,
  type OfflinePhoto,
  type OfflineBlob,
  type PendingMutation,
  type MutationType,
} from "./db";

// =====================================================================
// READS
// =====================================================================

export async function getLocalVisits(): Promise<OfflineVisit[]> {
  return idbGetAll<OfflineVisit>(STORES.visits);
}

export async function getLocalVisit(visitId: string): Promise<OfflineVisit | null> {
  return idbGet<OfflineVisit>(STORES.visits, visitId);
}

export async function getLocalFlock(flockId: string): Promise<OfflineFlock | null> {
  return idbGet<OfflineFlock>(STORES.flocks, flockId);
}

export async function getLocalFarm(farmId: string): Promise<OfflineFarm | null> {
  return idbGet<OfflineFarm>(STORES.farms, farmId);
}

export async function getLocalScoringDefinitions(): Promise<OfflineScoringDefinition[]> {
  return idbGetAll<OfflineScoringDefinition>(STORES.scoring_definitions);
}

export async function getLocalVisitScores(visitId: string): Promise<OfflineVisitScore[]> {
  return idbGetByIndex<OfflineVisitScore>(STORES.visit_scores, "by_visit", visitId);
}

export async function getLocalVisitFlocks(visitId: string): Promise<OfflineVisitFlock[]> {
  return idbGetByIndex<OfflineVisitFlock>(STORES.visit_flocks, "by_visit", visitId);
}

export async function getLocalPhotosForScore(visitScoreId: string): Promise<OfflinePhoto[]> {
  return idbGetByIndex<OfflinePhoto>(STORES.photos, "by_visit_score", visitScoreId);
}

// Composite read: assemble a full "visit detail" payload for the mobile scoring page
export async function getOfflineScoringPayload(visitId: string) {
  const visit = await getLocalVisit(visitId);
  if (!visit) return null;

  const farm = await getLocalFarm(visit.farm_id);
  const visitFlocks = await getLocalVisitFlocks(visitId);
  const flocks = await Promise.all(
    visitFlocks.map((vf) => getLocalFlock(vf.flock_id))
  );
  const definitions = await getLocalScoringDefinitions();
  const scores = await getLocalVisitScores(visitId);

  // Get photos for each score
  const scoresWithPhotos = await Promise.all(
    scores.map(async (s) => {
      const photos = await getLocalPhotosForScore(s.id);
      return { ...s, photos };
    })
  );

  return {
    visit,
    farm,
    flocks: flocks.filter(Boolean) as OfflineFlock[],
    definitions,
    scores: scoresWithPhotos,
  };
}

// =====================================================================
// WRITES (offline-first, queue mutation if needed)
// =====================================================================

/**
 * Save a visit_score change.
 * Always writes to IndexedDB locally and adds a mutation to the queue.
 * Sync engine flushes mutations when online.
 */
export async function saveVisitScoreLocal(input: {
  visitId: string;
  flockId: string;
  birdNumber: number;
  definitionId: string;
  fieldType: "score" | "numeric" | "sex";
  scoreValue: number | null;
  numericValue: number | null;
  textValue: string | null;
}): Promise<{ scoreId: string }> {
  // Find existing score row for this combination
  const allScoresForVisit = await getLocalVisitScores(input.visitId);
  const existing = allScoresForVisit.find(
    (s) =>
      s.flock_id === input.flockId &&
      s.bird_number === input.birdNumber &&
      s.definition_id === input.definitionId
  );

  let scoreId: string;
  let scoreRow: OfflineVisitScore;

  if (existing) {
    scoreId = existing.id;
    scoreRow = {
      ...existing,
      score: input.scoreValue,
      numeric_value: input.numericValue,
      text_value: input.textValue,
      _updated_at: new Date().toISOString(),
    };
  } else {
    scoreId = generateLocalId("score");
    scoreRow = {
      id: scoreId,
      visit_id: input.visitId,
      flock_id: input.flockId,
      bird_number: input.birdNumber,
      definition_id: input.definitionId,
      score: input.scoreValue,
      numeric_value: input.numericValue,
      text_value: input.textValue,
      _is_local: true,
      _updated_at: new Date().toISOString(),
    };
  }

  // Persist to local store
  await idbPut(STORES.visit_scores, scoreRow);

  // Queue mutation
  await queueMutation("upsert_score", {
    visitId: input.visitId,
    flockId: input.flockId,
    birdNumber: input.birdNumber,
    definitionId: input.definitionId,
    fieldType: input.fieldType,
    scoreValue: input.scoreValue,
    numericValue: input.numericValue,
    textValue: input.textValue,
    localScoreId: scoreId,
  });

  return { scoreId };
}

/**
 * Save a photo taken offline.
 * Stores blob in IndexedDB and queues upload mutation.
 *
 * IMPORTANT: visitId is required because the Supabase Storage RLS policy
 * for the visit-photos bucket checks that the first folder of the path is
 * a valid visit_id. Without it, uploads fail silently.
 */
export async function savePhotoLocal(input: {
  visitId: string;
  visitScoreId: string;
  blob: Blob;
}): Promise<{ photoId: string }> {
  const photoId = generateLocalId("photo");
  const blobId = generateLocalId("blob");

  // Save blob
  const blobRow: OfflineBlob = {
    id: blobId,
    blob: input.blob,
    mime_type: input.blob.type || "image/jpeg",
    visit_score_id: input.visitScoreId,
    created_at: new Date().toISOString(),
  };
  await idbPut(STORES.blobs, blobRow);

  // Save photo metadata
  const photoRow: OfflinePhoto = {
    id: photoId,
    visit_score_id: input.visitScoreId,
    storage_path: "",
    _local_blob_id: blobId,
    _is_local: true,
  };
  await idbPut(STORES.photos, photoRow);

  // Queue upload mutation (visitId required for RLS path)
  await queueMutation("upload_photo", {
    photoId,
    blobId,
    visitId: input.visitId,
    visitScoreId: input.visitScoreId,
  });

  return { photoId };
}

// =====================================================================
// MUTATION QUEUE
// =====================================================================

export async function queueMutation(type: MutationType, payload: any): Promise<void> {
  const mutation: PendingMutation = {
    id: generateLocalId("mut"),
    type,
    created_at: new Date().toISOString(),
    attempts: 0,
    payload,
  };
  await idbPut(STORES.mutations, mutation);
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
  const all = await idbGetAll<PendingMutation>(STORES.mutations);
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getPendingMutationsCount(): Promise<number> {
  const all = await idbGetAll<PendingMutation>(STORES.mutations);
  return all.length;
}

export async function deleteMutation(id: string): Promise<void> {
  await idbDelete(STORES.mutations, id);
}

export async function updateMutation(mutation: PendingMutation): Promise<void> {
  await idbPut(STORES.mutations, mutation);
}

// =====================================================================
// BULK SYNC HELPERS (called by sync engine)
// =====================================================================

export async function bulkPutVisits(visits: OfflineVisit[]): Promise<void> {
  await idbPutMany(STORES.visits, visits);
}

export async function bulkPutFlocks(flocks: OfflineFlock[]): Promise<void> {
  await idbPutMany(STORES.flocks, flocks);
}

export async function bulkPutFarms(farms: OfflineFarm[]): Promise<void> {
  await idbPutMany(STORES.farms, farms);
}

export async function bulkPutScoringDefinitions(defs: OfflineScoringDefinition[]): Promise<void> {
  await idbPutMany(STORES.scoring_definitions, defs);
}

export async function bulkPutVisitScores(scores: OfflineVisitScore[]): Promise<void> {
  await idbPutMany(STORES.visit_scores, scores);
}

export async function bulkPutVisitFlocks(rows: OfflineVisitFlock[]): Promise<void> {
  await idbPutMany(STORES.visit_flocks, rows);
}

export async function bulkPutPhotos(photos: OfflinePhoto[]): Promise<void> {
  await idbPutMany(STORES.photos, photos);
}

export async function getBlob(blobId: string): Promise<OfflineBlob | null> {
  return idbGet<OfflineBlob>(STORES.blobs, blobId);
}

export async function deleteBlob(blobId: string): Promise<void> {
  await idbDelete(STORES.blobs, blobId);
}
