import mammoth from 'mammoth';
import type { jsPDF } from 'jspdf';
import { extractText, getDocumentProxy } from 'unpdf';
import { validateResumeFile } from '@/lib/file-validation';
import { isJobPostingUrl } from '@/lib/job-url';

const MIN_RESUME_TEXT_LENGTH = 50;

export class ResumeExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumeExtractionError';
  }
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export { MAX_RESUME_FILE_SIZE_BYTES } from '@/lib/file-validation';

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, {
    mergePages: true,
  });
  return text.trim();
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

async function extractPlainText(buffer: Buffer): Promise<string> {
  return buffer.toString('utf-8').trim();
}

export async function extractResumeText(file: File): Promise<string> {
  const buffer = await validateResumeFile(file);
  const extension = getFileExtension(file.name);

  let text = '';

  switch (extension) {
    case 'pdf':
      text = await extractPdfText(buffer);
      break;
    case 'docx':
      text = await extractDocxText(buffer);
      break;
    case 'txt':
      text = await extractPlainText(buffer);
      break;
    default:
      throw new ResumeExtractionError(
        'Unsupported file type. Please upload PDF, DOCX, or TXT.',
      );
  }

  if (text.length < MIN_RESUME_TEXT_LENGTH) {
    throw new ResumeExtractionError(
      'Could not extract enough text from the resume. Try another file format.',
    );
  }

  return text;
}

// --- PDF generation ---

type ResumeBlockType =
  | 'name'
  | 'title'
  | 'contact'
  | 'section'
  | 'subsection'
  | 'paragraph'
  | 'bullet';

interface ResumeBlock {
  type: ResumeBlockType;
  text: string;
}

const SECTION_KEYWORDS =
  /^(professional profile|core technical skills|technical skills|skills|professional experience|experience|selected projects|projects|education|additional strengths|summary|certifications)$/i;

const PAGE = {
  format: 'a4' as const,
  marginX: 14,
  marginTop: 16,
  marginBottom: 14,
};

const TYPE = {
  name: {
    size: 20,
    style: 'bold' as const,
    color: [0, 0, 0] as const,
  },
  title: {
    size: 11.5,
    style: 'normal' as const,
    color: [34, 34, 34] as const,
  },
  contact: {
    size: 9.5,
    style: 'normal' as const,
    color: [68, 68, 68] as const,
  },
  section: {
    size: 11,
    style: 'bold' as const,
    color: [0, 0, 0] as const,
  },
  subsection: {
    size: 10.5,
    style: 'bold' as const,
    color: [0, 0, 0] as const,
  },
  paragraph: {
    size: 10,
    style: 'normal' as const,
    color: [34, 34, 34] as const,
  },
  bullet: {
    size: 10,
    style: 'normal' as const,
    color: [34, 34, 34] as const,
  },
};

const SPACING = {
  afterName: 6,
  afterTitle: 4,
  afterContact: 5,
  beforeSection: 5,
  afterSectionTitle: 2,
  afterSectionLine: 4,
  sectionLineWidth: 0.35,
  beforeSubsection: 3,
  afterSubsectionTitle: 1,
  line: 4.6,
  bulletGap: 4.2,
  bulletIndent: 4,
  bulletMarkerX: 1.8,
};

function cleanLine(line: string): string {
  return line
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .trim();
}

function isSectionHeader(line: string): boolean {
  const cleaned = cleanLine(line);
  if (SECTION_KEYWORDS.test(cleaned)) return true;
  return (
    cleaned.length > 3 &&
    cleaned === cleaned.toUpperCase() &&
    /[A-Z]/.test(cleaned)
  );
}

function isBulletLine(line: string): boolean {
  return /^[-*•▪]\s+/.test(line);
}

function isContactLine(line: string): boolean {
  return (
    line.includes('|') &&
    (/@/.test(line) || /linkedin|github|portfolio|phone|\+?\d{7,}/i.test(line))
  );
}

function isSubsectionLine(line: string): boolean {
  return line.split('|').length >= 3;
}

function parseResumeContent(content: string): ResumeBlock[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: ResumeBlock[] = [];
  let headerLines = 0;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    if (rawLine.startsWith('# ')) {
      blocks.push({ type: 'name', text: line });
      headerLines += 1;
      continue;
    }

    if (rawLine.startsWith('## ')) {
      if (isSectionHeader(line)) {
        blocks.push({
          type: 'section',
          text: line.toUpperCase(),
        });
      } else if (headerLines === 1) {
        blocks.push({ type: 'title', text: line });
        headerLines += 1;
      } else {
        blocks.push({
          type: 'section',
          text: line.toUpperCase(),
        });
      }
      continue;
    }

    if (rawLine.startsWith('### ')) {
      blocks.push({ type: 'subsection', text: line });
      continue;
    }

    if (isBulletLine(rawLine)) {
      blocks.push({
        type: 'bullet',
        text: line.replace(/^[-*•▪]\s+/, ''),
      });
      continue;
    }

    if (isSectionHeader(line)) {
      blocks.push({
        type: 'section',
        text: line.toUpperCase(),
      });
      continue;
    }

    if (headerLines < 2 && blocks.length === 0) {
      blocks.push({ type: 'name', text: line });
      headerLines += 1;
      continue;
    }

    if (headerLines < 3 && blocks.length === 1) {
      blocks.push({ type: 'title', text: line });
      headerLines += 1;
      continue;
    }

    if (
      headerLines < 4 &&
      isContactLine(line) &&
      !blocks.some((block) => block.type === 'contact')
    ) {
      blocks.push({ type: 'contact', text: line });
      headerLines += 1;
      continue;
    }

    if (isSubsectionLine(line)) {
      blocks.push({ type: 'subsection', text: line });
      continue;
    }

    blocks.push({ type: 'paragraph', text: line });
  }

  return blocks;
}

interface RenderState {
  y: number;
}

function getPageSize(doc: jsPDF) {
  return {
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight(),
  };
}

function ensureSpace(doc: jsPDF, state: RenderState, height: number): void {
  const { height: pageHeight } = getPageSize(doc);
  if (state.y + height <= pageHeight - PAGE.marginBottom) return;
  doc.addPage();
  state.y = PAGE.marginTop;
}

function setTypeStyle(doc: jsPDF, type: keyof typeof TYPE): void {
  const config = TYPE[type];
  doc.setFont('helvetica', config.style);
  doc.setFontSize(config.size);
  doc.setTextColor(config.color[0], config.color[1], config.color[2]);
}

function writeLines(
  doc: jsPDF,
  state: RenderState,
  lines: string[],
  x: number,
  lineHeight: number,
): void {
  for (const line of lines) {
    ensureSpace(doc, state, lineHeight);
    doc.text(line, x, state.y);
    state.y += lineHeight;
  }
}

function renderBlock(
  doc: jsPDF,
  state: RenderState,
  block: ResumeBlock,
  previousBlock: ResumeBlock | null,
): void {
  const { width: pageWidth } = getPageSize(doc);
  const contentWidth = pageWidth - PAGE.marginX * 2;

  switch (block.type) {
    case 'name':
      setTypeStyle(doc, 'name');
      ensureSpace(doc, state, TYPE.name.size);
      doc.text(block.text, PAGE.marginX, state.y);
      state.y += SPACING.afterName;
      return;

    case 'title':
      setTypeStyle(doc, 'title');
      ensureSpace(doc, state, TYPE.title.size);
      doc.text(block.text, PAGE.marginX, state.y);
      state.y += SPACING.afterTitle;
      return;

    case 'contact':
      setTypeStyle(doc, 'contact');
      writeLines(
        doc,
        state,
        doc.splitTextToSize(block.text, contentWidth),
        PAGE.marginX,
        SPACING.line,
      );
      state.y += SPACING.afterContact - SPACING.line;
      return;

    case 'section':
      state.y += SPACING.beforeSection;
      setTypeStyle(doc, 'section');
      ensureSpace(doc, state, TYPE.section.size);
      doc.text(block.text.toUpperCase(), PAGE.marginX, state.y);
      state.y += SPACING.afterSectionTitle;
      ensureSpace(doc, state, SPACING.afterSectionLine);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(SPACING.sectionLineWidth);
      doc.line(PAGE.marginX, state.y, PAGE.marginX + contentWidth, state.y);
      state.y += SPACING.afterSectionLine;
      return;

    case 'subsection':
      if (previousBlock && previousBlock.type !== 'section') {
        state.y += SPACING.beforeSubsection;
      }
      setTypeStyle(doc, 'subsection');
      writeLines(
        doc,
        state,
        doc.splitTextToSize(block.text, contentWidth),
        PAGE.marginX,
        SPACING.line,
      );
      state.y += SPACING.afterSubsectionTitle;
      return;

    case 'bullet': {
      setTypeStyle(doc, 'bullet');
      const bulletX = PAGE.marginX + SPACING.bulletIndent;
      const textWidth = contentWidth - SPACING.bulletIndent;
      const lines = doc.splitTextToSize(block.text, textWidth);

      for (const line of lines) {
        ensureSpace(doc, state, SPACING.bulletGap);
        if (line === lines[0]) {
          doc.text('•', PAGE.marginX + SPACING.bulletMarkerX, state.y);
        }
        doc.text(line, bulletX, state.y);
        state.y += SPACING.bulletGap;
      }
      return;
    }

    case 'paragraph':
      setTypeStyle(doc, 'paragraph');
      writeLines(
        doc,
        state,
        doc.splitTextToSize(block.text, contentWidth),
        PAGE.marginX,
        SPACING.line,
      );
  }
}

function slugifyFilePart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function extractCandidateName(content: string): string | null {
  const blocks = parseResumeContent(content);
  const nameBlock = blocks.find((block) => block.type === 'name');

  if (!nameBlock?.text.trim()) return null;

  return nameBlock.text.trim();
}

export function extractCompanyName(jobDescription: string): string | null {
  const text = jobDescription.trim();
  if (!text) return null;

  const patterns = [
    /(?:company|organisation|organization)\s*[:-]\s*([^\n|,]+)/i,
    /(?:at|@)\s+([A-Z][\w&.' -]{1,50}?)(?:\s*(?:\||-)|$|\n)/m,
    /(?:join|joining)\s+([A-Z][\w&.' -]{1,50}?)(?:\s*(?:\||-)|$|\n)/im,
    /^([A-Z][\w&.' -]{1,50}?)\s+(?:is hiring|is looking|hiring)/im,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const company = match?.[1]?.trim();
    if (company && company.length >= 2) {
      return company.replace(/\s+/g, ' ');
    }
  }

  try {
    if (isJobPostingUrl(text)) {
      const host = new URL(text).hostname.replace(/^www\./, '');
      const jobBoards = [
        'linkedin',
        'indeed',
        'glassdoor',
        'djinni',
        'dou',
        'work',
        'reed',
        'totaljobs',
        'greenhouse',
        'lever',
        'workday',
        'smartrecruiters',
      ];
      const brand = host.split('.')[0]?.toLowerCase();
      if (brand && !jobBoards.includes(brand)) {
        return brand.charAt(0).toUpperCase() + brand.slice(1);
      }
    }
  } catch {
    // Ignore invalid URLs.
  }

  return null;
}

export function buildResumePdfFileName(
  content: string,
  jobDescription = '',
): string {
  const candidate = extractCandidateName(content) ?? 'Candidate';
  const company = extractCompanyName(jobDescription) ?? 'Company';

  const candidateSlug = slugifyFilePart(candidate) || 'Candidate';
  const companySlug = slugifyFilePart(company) || 'Company';

  return `${candidateSlug}-${companySlug}-Resume.pdf`;
}

export async function downloadResumePdf(
  content: string,
  jobDescription = '',
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    unit: 'mm',
    format: PAGE.format,
  });

  const blocks = parseResumeContent(content);
  const state: RenderState = { y: PAGE.marginTop };
  const fileName = buildResumePdfFileName(content, jobDescription);

  if (blocks.length === 0) {
    setTypeStyle(doc, 'paragraph');
    writeLines(
      doc,
      state,
      doc.splitTextToSize(content, getPageSize(doc).width - PAGE.marginX * 2),
      PAGE.marginX,
      SPACING.line,
    );
  } else {
    let previousBlock: ResumeBlock | null = null;

    for (const block of blocks) {
      renderBlock(doc, state, block, previousBlock);
      previousBlock = block;
    }
  }

  doc.save(fileName);
}
