// ═══════════════════════════════════════════════════════════════
//  NACTUS — APPWRITE STORAGE MODULE
//  Chargé via <script type="module" src="appwrite-storage.js">
//  Remplace Firebase Storage pour tous les uploads (images, fichiers, avatars).
//  Firebase Firestore + Auth restent inchangés.
//
//  IMPORTANT : ce fichier dépend du SDK Appwrite chargé JUSTE AVANT lui,
//  via un <script> classique (pas un module) :
//    <script src="https://cdn.jsdelivr.net/npm/appwrite@17.0.0"></script>

//    <script type="module" src="appwrite-storage.js"></script>
//  Le script classique est bloquant : il s'exécute et expose window.Appwrite
//  AVANT que ce module ne démarre. C'est la méthode officiellement
//  documentée par Appwrite pour un usage via CDN (voir appwrite.io/docs).
//  Un import ESM direct vers un chemin de fichier interne (dist/esm/sdk.js)
//  n'est PAS garanti stable d'une version à l'autre et peut casser silencieusement.
// ═══════════════════════════════════════════════════════════════

if (!window.Appwrite) {
  throw new Error(
    "Le SDK Appwrite n'est pas chargé. Ajoutez <script src=\"https://cdn.jsdelivr.net/npm/appwrite@17.0.0\"></script> avant appwrite-storage.js."
  );
}

const { Client, Storage, ID } = window.Appwrite;

// ─── Configuration Appwrite ────────────────────────────────────
const APPWRITE_ENDPOINT = "https://sgp.cloud.appwrite.io/v1";
const APPWRITE_PROJECT   = "6a46b5130022826c78c7";
const APPWRITE_BUCKET_ID = "6a46b5e1003d61713370";
// ─── Init client (seulement si le SDK a bien été trouvé) ──────
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
  articleVideo:   "article-video",   // vidéos uploadées directement (MP4, WebM…)
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
  try {
    return storage.getFileView(APPWRITE_BUCKET_ID, fileId).toString();
  } catch {
    return `${APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT}`;
  }
}

/**
 * Upload un fichier vers Appwrite Storage avec suivi de progression.
 * @param {File}   file        - Fichier à uploader
 * @param {string} type        - Clé dans PATHS (ex: "articleImage")
 * @param {Object} progressEl  - { fill, label, wrap } IDs des éléments de progression
 * @returns {Promise<{url: string, fileId: string}>}
 */
async function uploadToAppwrite(file, type, progressEl = null) {
  if (!storage) {
    throw new Error("Le SDK Appwrite n'a pas pu être chargé (script CDN manquant ou bloqué). Vérifiez votre connexion et rechargez la page.");
  }

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
  if (!fileId || !storage) return;
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

if (storage) {
  console.log("✅ Appwrite Storage initialisé (bucket:", APPWRITE_BUCKET_ID, ")");
} else {
  console.error("❌ Appwrite Storage NON initialisé — le SDK n'a pas pu être chargé.");
}