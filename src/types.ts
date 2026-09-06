
export type ImpositionPreset = 'pocketbook-a6' | 'mini-pocket-a7' | 'booklet-a5' | 'cut-stack';

export type SignatureSetting = 'single' | 3 | 4 | 5 | 'custom' | number;

export interface ImpositionConfig {
  preset: ImpositionPreset;
  sheetsPerSignature: SignatureSetting;
  customSheetsCount?: number;
  addCropMarks: boolean;
  addFoldGuides: boolean;
  addSignatureLabels: boolean;
}

export interface GenerationHistory {
  id: string;
  timestamp: number;
  fileName: string;
  preset: ImpositionPreset;
  pageCount: number;
  sheetsGenerated: number;
  signaturesCount: number;
  blankPagesCount: number;
}

export interface PDFMetadata {
  pageCount: number;
  fileName: string;
  fileSize: number;
}

export interface ImpositionStats {
  originalPages: number;
  totalPagesWithBlanks: number;
  blankPagesAdded: number;
  signaturesCount: number;
  sheetsPerSignature: number; // max sheets capacity
  signatureSheets: number[]; // real sheets per signature (e.g. [5, 3] or [2])
  signatureDetailsSummary: string; // descriptive text of signatures
  totalA4Sheets: number;
  totalImposedPages: number; // front and back surfaces
}

export interface ImpositionResult {
  pdfBytes: Uint8Array;
  stats: ImpositionStats;
}
