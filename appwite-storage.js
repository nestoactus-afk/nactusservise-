// ═══════════════════════════════════════════════════════════════
//  NACTUS — APPWRITE STORAGE MODULE
//  Chargé via <script type="module" src="appwrite-storage.js">
//  Remplace Firebase Storage pour tous les uploads (images, fichiers, avatars).
//  Firebase Firestore + Auth restent inchangés.
// ═══════════════════════════════════════════════════════════════

import { Client, Storage, ID } from "https://cdn.jsdelivr.net/npm/appwrite@15/dist/esm/sdk.js";

// ─── Configuration Appwrite ────────────────────────────────────
const APPWRITE_ENDPOINT  = "https://cloud.appwrite.io/v1";
const APPWRITE_PROJECT   = "6a46b9c900293960f1f6";
const APPWRITE_BUCKET_ID = "6a46b5e1003d61713370";

// ─── Init client ──────────────────────────────────────────────
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT);

const storage = new Storage(client);

// ─── Chemins logiques → préfixes dans le bucket ───────────────
// Appwrite Storage utilise un seul bucket avec des IDs uniques.
// On encode le "dossier" dans le nom du fichier pour l'organisation.
const PATHS = {
  articleImage:   "article-image",   // images de couverture
  contentImage:   "content-image",   // images insérées dans Quill
  articleFile:    "article-file",    // fichiers joints (PDF, DOCX…)
  avatar:         "avatar",          // avatars utilisateurs
};

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Construit un nom de fichier unique avec préfixe de type.
 * Ex : "article-image_1720000000000_photo.jpg"
 */
function buildFileName(type, originalName) {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80);
  return `${type}_${Date.now()}_${safe}`;
}

/**
 * Retourne l'URL publique de lecture d'un fichier Appwrite.
 * Cette URL est accessible sans authentification (lecture publique du bucket).
 */
function getPublicUrl(fileId) {
  return `${APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT}`;
}

/**
 * Upload un fichier vers Appwrite Storage avec suivi de progression.
 * @param {File}   file        - Fichier à uploader
 * @param {string} type        - Clé dans PATHS (ex: "articleImage")
 * @param {Object} progressEl  - { fill, label, wrap } IDs des éléments de progression
 * @returns {Promise<{url: string, fileId: string}>}
 */
async function uploadToAppwrite(file, type, progressEl = null) {
  // Affiche la barre de progression si fournie
  if (progressEl?.wrap) {
    const wrap = document.getElementById(progressEl.wrap);
    if (wrap) wrap.style.display = "block";
  }
  const setProgress = (pct) => {
    if (!progressEl) return;
    const fill  = progressEl.fill  ? document.getElementById(progressEl.fill)  : null;
    const label = progressEl.label ? document.getElementById(progressEl.label) : null;
    if (fill)  fill.style.width   = pct + "%";
    if (label) label.textContent  = pct + "%";
  };

  setProgress(10); // démarre visuellement

  try {
    const fileName = buildFileName(PATHS[type] || type, file.name);

    // Appwrite SDK v15 : createFile(bucketId, fileId, file)
    // ID.unique() génère un ID unique côté client.
    setProgress(40);
    const result = await storage.createFile(
      APPWRITE_BUCKET_ID,
      ID.unique(),
      new File([file], fileName, { type: file.type })
    );
    setProgress(100);

    const url = getPublicUrl(result.$id);
    return { url, fileId: result.$id };

  } catch (err) {
    setProgress(0);
    throw new Error(`Échec de l'upload Appwrite : ${err.message}`);
  }
}

/**
 * Supprime un fichier du bucket Appwrite (optionnel, pour le nettoyage).
 * @param {string} fileId - L'ID Appwrite du fichier à supprimer
 */
async function deleteFromAppwrite(fileId) {
  if (!fileId) return;
  try {
    await storage.deleteFile(APPWRITE_BUCKET_ID, fileId);
  } catch (err) {
    console.warn("Appwrite delete:", err.message);
  }
}

// ─── Expose l'API sur window.NACTUS_STORAGE ───────────────────
// Toutes les pages accèdent au stockage via window.NACTUS_STORAGE
// sans avoir à importer ce module directement.
window.NACTUS_STORAGE = {
  upload: uploadToAppwrite,
  delete: deleteFromAppwrite,
  getUrl: getPublicUrl,
  PATHS,
};

console.log("✅ Appwrite Storage initialisé (bucket:", APPWRITE_BUCKET_ID, ")");
