import * as fs from 'fs';
import { join } from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  PageBreak,
  Header,
  Footer,
  convertInchesToTwip,
  LevelFormat,
  SimpleField,
} from 'docx';
import { getOutputDir } from '../config.js';

export interface DocSection {
  heading: string;
  content: string;
  level?: 1 | 2 | 3;     // Heading level (default: 2)
  table?: DocTable;        // Optional table for this section
}

export interface DocTable {
  headers: string[];
  rows: string[][];
}

export interface GenerateDocxOptions {
  filename: string;
  title: string;
  subtitle?: string;
  author?: string;
  sections: DocSection[];
  outputDir?: string;
}

export interface GenerateDocxResult {
  filePath: string;
  sizeBytes: number;
}

// ── Color Palette ────────────────────────────────────────
const COLORS = {
  primary:      '1F4E79',   // Deep navy blue
  primaryLight: 'D6E4F0',   // Light blue
  accent:       '2E86C1',   // Accent blue
  gray:         '5D6D7E',   // Body text gray
  lightGray:    'F2F3F4',   // Alternating table row
  white:        'FFFFFF',
  black:        '000000',
};

// ── Helpers ───────────────────────────────────────────────
function boldText(text: string, color = COLORS.black): TextRun {
  return new TextRun({ text, bold: true, color, font: 'Calibri' });
}

function bodyText(text: string): TextRun {
  return new TextRun({ text, font: 'Calibri', size: 22, color: COLORS.gray });
}

// ── Build Styled Table ────────────────────────────────────
function buildTable(tableData: DocTable): Table {
  const headerCells = tableData.headers.map(
    (h) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [boldText(h, COLORS.white)],
            alignment: AlignmentType.CENTER,
          }),
        ],
        shading: { type: ShadingType.SOLID, color: COLORS.primary, fill: COLORS.primary },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
      })
  );

  const dataRows = tableData.rows.map((row, rowIdx) =>
    new TableRow({
      children: row.map(
        (cell) =>
          new TableCell({
            children: [new Paragraph({ children: [bodyText(cell)] })],
            shading:
              rowIdx % 2 === 0
                ? undefined
                : { type: ShadingType.SOLID, color: COLORS.lightGray, fill: COLORS.lightGray },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
          })
      ),
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows],
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: COLORS.primary },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.primary },
      left:   { style: BorderStyle.SINGLE, size: 4, color: COLORS.primary },
      right:  { style: BorderStyle.SINGLE, size: 4, color: COLORS.primary },
    },
  });
}

// ── Parse markdown-style content to Paragraphs ────────────
function parseContentToParagraphs(content: string): Paragraph[] {
  const lines = content.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ children: [] }));
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      paragraphs.push(
        new Paragraph({
          children: [bodyText(trimmed.slice(2))],
          bullet: { level: 0 },
        })
      );
      continue;
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      paragraphs.push(
        new Paragraph({
          children: [bodyText(numberedMatch[2])],
          numbering: { reference: 'numbered-list', level: 0 },
        })
      );
      continue;
    }

    paragraphs.push(new Paragraph({ children: [bodyText(trimmed)] }));
  }

  return paragraphs;
}

/**
 * MCP Tool: generate_word_doc
 *
 * Generates a professionally styled Word (.docx) document and saves it
 * to the output directory. Returns the file path and size.
 */
export async function generateWordDoc(options: GenerateDocxOptions): Promise<GenerateDocxResult> {
  const { filename, title, subtitle, author, sections, outputDir } = options;
  const resolvedOutputDir = outputDir ?? getOutputDir();

  fs.mkdirSync(resolvedOutputDir, { recursive: true });

  const allChildren: (Paragraph | Table)[] = [];

  // ── Cover Title ───────────────────────────────────────────
  allChildren.push(
    new Paragraph({
      children: [
        new TextRun({ text: title, bold: true, size: 56, font: 'Calibri', color: COLORS.primary }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: convertInchesToTwip(1.5), after: 200 },
    })
  );

  if (subtitle) {
    allChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: subtitle, size: 28, font: 'Calibri', color: COLORS.accent, italics: true }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
  }

  const metaLine = [
    author ? `Author: ${author}` : '',
    `Generated: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`,
  ]
    .filter(Boolean)
    .join('   |   ');

  allChildren.push(
    new Paragraph({
      children: [bodyText(metaLine)],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // ── Sections ──────────────────────────────────────────────
  for (const section of sections) {
    const level = section.level ?? 2;

    allChildren.push(
      new Paragraph({
        text: section.heading,
        heading:
          level === 1
            ? HeadingLevel.HEADING_1
            : level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3,
        spacing: { before: 300, after: 120 },
      })
    );

    allChildren.push(...parseContentToParagraphs(section.content));

    if (section.table) {
      allChildren.push(
        new Paragraph({ children: [] }),
        buildTable(section.table),
        new Paragraph({ children: [] })
      );
    }

    allChildren.push(new Paragraph({ children: [] }));
  }

  // ── Build Document ────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'numbered-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    styles: {
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: { bold: true, size: 36, color: COLORS.primary, font: 'Calibri' },
          paragraph: { spacing: { before: 300, after: 120 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          run: { bold: true, size: 28, color: COLORS.accent, font: 'Calibri' },
          paragraph: { spacing: { before: 240, after: 80 } },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          run: { bold: true, size: 24, color: COLORS.gray, font: 'Calibri' },
          paragraph: { spacing: { before: 200, after: 60 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left:   convertInchesToTwip(1.25),
              right:  convertInchesToTwip(1.25),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: title, font: 'Calibri', size: 18, color: COLORS.primary, bold: true }),
                  new TextRun({ text: '  |  E2E Copilot Agents', font: 'Calibri', size: 18, color: COLORS.gray }),
                ],
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primary },
                },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Page ', font: 'Calibri', size: 18, color: COLORS.gray }),
                  // docx v9: use SimpleField for PAGE number
                  new SimpleField('PAGE'),
                ],
                alignment: AlignmentType.RIGHT,
                border: {
                  top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.primaryLight },
                },
              }),
            ],
          }),
        },
        children: allChildren,
      },
    ],
  });

  const safeFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  const filePath = join(resolvedOutputDir, safeFilename);

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);

  return { filePath, sizeBytes: buffer.byteLength };
}
