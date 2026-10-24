import { Router } from "express";
import { db } from "@workspace/db";
import {
  salesTable, customersTable, apartmentsTable, objectsTable,
  blocksTable, buildingsTable, quartersTable, installmentsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, HeadingLevel, ShadingType,
  PageMargin, VerticalAlign, convertInchesToTwip,
} from "docx";

const router = Router();

// ── Azerbaijani month names ───────────────────────────────────────────────────
const AZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"
];

function formatDateAz(date: Date): string {
  return `${date.getDate()} ${AZ_MONTHS[date.getMonth()]} ${date.getFullYear()}-ci il`;
}

// ── Number to Azerbaijani words ───────────────────────────────────────────────
const ONES = ["", "bir", "iki", "üç", "dörd", "beş", "altı", "yeddi", "səkkiz", "doqquz"];
const TENS = ["", "on", "iyirmi", "otuz", "qırx", "əlli", "altmış", "yetmiş", "səksən", "doxsan"];

/** Convert a non-negative integer to Azerbaijani words (no currency suffix) */
function intToWords(n: number): string {
  if (n === 0) return "sıfır";
  let result = "";
  if (n >= 1000000) {
    result += intToWords(Math.floor(n / 1000000)) + " milyon";
    const rest = n % 1000000;
    if (rest > 0) result += " " + intToWords(rest);
  } else if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    result += (thousands === 1 ? "min" : intToWords(thousands) + " min");
    const rest = n % 1000;
    if (rest > 0) result += " " + intToWords(rest);
  } else if (n >= 100) {
    const hundreds = Math.floor(n / 100);
    result += (hundreds === 1 ? "yüz" : ONES[hundreds] + " yüz");
    const rest = n % 100;
    if (rest > 0) result += " " + intToWords(rest);
  } else if (n >= 10) {
    result += TENS[Math.floor(n / 10)];
    const ones = n % 10;
    if (ones > 0) result += " " + ONES[ones];
  } else {
    result += ONES[n];
  }
  return result.trim();
}

/** Convert a number to Azerbaijani currency words: "74700" → "yetmiş dörd min yeddi yüz manat" */
function numToAz(n: number): string {
  const integer = Math.floor(Math.round(n * 100) / 100);
  const decimal = Math.round((n - integer) * 100);
  const words = intToWords(integer);
  return decimal > 0 ? `${words} manat ${decimal} qəpik` : `${words} manat`;
}

function formatCurr(n: number): string {
  return n.toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " AZN";
}

// ── Helper paragraph builders for docx ─────────────────────────────────────────
function para(text: string, opts: {
  bold?: boolean; italic?: boolean; size?: number;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  spaceBefore?: number; spaceAfter?: number; indent?: number;
} = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({
      text,
      bold: opts.bold,
      italics: opts.italic,
      size: (opts.size ?? 11) * 2,
      font: "Times New Roman",
    })],
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: {
      before: convertInchesToTwip((opts.spaceBefore ?? 0) / 72),
      after: convertInchesToTwip((opts.spaceAfter ?? 4) / 72),
      line: 276,
    },
    indent: opts.indent ? { left: convertInchesToTwip(opts.indent / 72) } : undefined,
  });
}

function mixed(runs: Array<{ text: string; bold?: boolean; italic?: boolean; underline?: boolean }>, opts: {
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  spaceBefore?: number; spaceAfter?: number; indent?: number; size?: number;
} = {}): Paragraph {
  return new Paragraph({
    children: runs.map(r => new TextRun({
      text: r.text,
      bold: r.bold,
      italics: r.italic,
      underline: r.underline ? {} : undefined,
      size: (opts.size ?? 11) * 2,
      font: "Times New Roman",
    })),
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: {
      before: convertInchesToTwip((opts.spaceBefore ?? 0) / 72),
      after: convertInchesToTwip((opts.spaceAfter ?? 4) / 72),
      line: 276,
    },
    indent: opts.indent ? { left: convertInchesToTwip(opts.indent / 72) } : undefined,
  });
}

function heading(text: string, level: 1 | 2 = 1): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: (level === 1 ? 14 : 12) * 2, font: "Times New Roman" })],
    alignment: AlignmentType.CENTER,
    spacing: { before: convertInchesToTwip(6 / 72), after: convertInchesToTwip(4 / 72), line: 276 },
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: "", size: 22, font: "Times New Roman" })], spacing: { before: 0, after: 0 } });
}

function tableCell(text: string, bold = false, width = 50): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold, size: 22, font: "Times New Roman" })],
      alignment: AlignmentType.LEFT,
      spacing: { before: convertInchesToTwip(2 / 72), after: convertInchesToTwip(2 / 72) },
    })],
    width: { size: width, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    },
  });
}

// ── Contract Data Builder (Both Apartment & Object) ───────────────────────────
async function getContractData(saleId: number) {
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId)).limit(1);
  if (!sale) throw new Error("Satış tapılmadı");
  if (sale.assetType !== "apartment" && sale.assetType !== "object") {
    throw new Error("Yalnız mənzil və qeyri-yaşayış sahəsi satışları üçün müqavilə yaradılır");
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, sale.customerId)).limit(1);
  if (!customer) throw new Error("Sakin tapılmadı");

  let assetDetails: {
    assetType: "apartment" | "object";
    titleSub: string;
    objectTypeDesc: string;
    number: string;
    floor: string;
    rooms: string;
    area: number;
    activityType: string;
    blockName: string;
    buildingName: string;
    quarterName: string;
  };

  if (sale.assetType === "apartment") {
    const [apt] = await db
      .select({
        number: apartmentsTable.number,
        floor: apartmentsTable.floor,
        rooms: apartmentsTable.rooms,
        area: apartmentsTable.area,
        blockName: blocksTable.name,
        buildingName: buildingsTable.name,
        quarterName: quartersTable.name,
      })
      .from(apartmentsTable)
      .leftJoin(blocksTable, eq(apartmentsTable.blockId, blocksTable.id))
      .leftJoin(buildingsTable, eq(blocksTable.buildingId, buildingsTable.id))
      .leftJoin(quartersTable, eq(buildingsTable.quarterId, quartersTable.id))
      .where(eq(apartmentsTable.id, sale.assetId))
      .limit(1);
    if (!apt) throw new Error("Mənzil tapılmadı");
    assetDetails = {
      assetType: "apartment",
      titleSub: "(Yaşayış kompleksində mənzil alqı-satqısına dair)",
      objectTypeDesc: "mənzili",
      number: String(apt.number),
      floor: `${apt.floor}-ci mərtəbə`,
      rooms: `${apt.rooms} otaq`,
      area: Number(apt.area),
      activityType: "Yaşayış mənzili",
      blockName: apt.blockName ?? "—",
      buildingName: apt.buildingName ?? "Naxçıvan Residence",
      quarterName: apt.quarterName ?? "—",
    };
  } else {
    const [obj] = await db
      .select({
        number: objectsTable.number,
        area: objectsTable.area,
        activityType: objectsTable.activityType,
        blockName: blocksTable.name,
        buildingName: buildingsTable.name,
        quarterName: quartersTable.name,
      })
      .from(objectsTable)
      .leftJoin(blocksTable, eq(objectsTable.blockId, blocksTable.id))
      .leftJoin(buildingsTable, eq(blocksTable.buildingId, buildingsTable.id))
      .leftJoin(quartersTable, eq(blocksTable.quarterId, quartersTable.id))
      .where(eq(objectsTable.id, sale.assetId))
      .limit(1);
    if (!obj) throw new Error("Qeyri-yaşayış sahəsi tapılmadı");
    assetDetails = {
      assetType: "object",
      titleSub: "(Qeyri-yaşayış / Kommersiya sahəsinin alqı-satqısına dair)",
      objectTypeDesc: "qeyri-yaşayış sahəsini",
      number: String(obj.number),
      floor: "1-ci mərtəbə",
      rooms: "Qeyri-yaşayış / Kommersiya",
      area: Number(obj.area),
      activityType: obj.activityType || "Qeyri-yaşayış / Kommersiya sahəsi",
      blockName: obj.blockName ?? "1-ci mərtəbə",
      buildingName: obj.buildingName ?? "Naxçıvan Residence",
      quarterName: obj.quarterName ?? "—",
    };
  }

  const isCredit = sale.saleType === "credit" || sale.saleType === "installment";
  let lastInstDate: Date | null = null;
  if (isCredit) {
    const installments = await db
      .select({ dueDate: installmentsTable.dueDate })
      .from(installmentsTable)
      .where(eq(installmentsTable.saleId, saleId));
    if (installments.length > 0) {
      lastInstDate = installments.reduce((max, i) =>
        i.dueDate > max ? i.dueDate : max, installments[0].dueDate);
    }
  }

  const contractDate = formatDateAz(new Date(sale.saleDate));
  const buyerFullName = [customer.lastName, customer.firstName, customer.fatherName].filter(Boolean).join(" ");
  const idCard = customer.idCardNumber ?? "_______________";
  const idCardType = customer.idCardType ?? "";
  const fin = customer.fin ?? "_______";
  const address = customer.address ?? "Naxçıvan şəhəri";
  const phone = customer.phone ?? "";
  const totalAmount = Number(sale.totalAmount);
  const downPayment = Number(sale.downPayment ?? 0);
  const remaining = Math.max(0, totalAmount - downPayment);
  const monthlyPayment = Number(sale.monthlyPayment ?? 0);
  const installmentMonths = Number(sale.installmentMonths ?? 0);
  const pricePerSqm = Number(sale.pricePerSqm ?? 0);
  const contractNo = sale.contractNumber ?? "___";
  const qaimeNo = sale.qaimeNumber ?? "";
  const finalPayDate = lastInstDate ? formatDateAz(lastInstDate) : "________________";
  const installStartDate = formatDateAz(new Date(sale.saleDate));

  return {
    saleId,
    contractNo,
    qaimeNo,
    contractDate,
    buyerFullName,
    idCard,
    idCardType,
    fin,
    address,
    phone,
    totalAmount,
    totalAmountWords: numToAz(totalAmount),
    downPayment,
    downPaymentWords: numToAz(downPayment),
    remaining,
    remainingWords: numToAz(remaining),
    monthlyPayment,
    monthlyPaymentWords: numToAz(monthlyPayment),
    installmentMonths,
    pricePerSqm,
    pricePerSqmWords: numToAz(pricePerSqm),
    isCredit,
    finalPayDate,
    installStartDate,
    seller: {
      name: '"APF Construction" Məhdud Məsuliyyətli Cəmiyyəti',
      shortName: '"APF Construction" MMC',
      director: "Bədəlov Həsən İlham oğlu",
      address: "Naxçıvan şəhəri, 49-cu məhəllə, 1/7",
    },
    asset: assetDetails,
  };
}

// ── GET /api/contracts/:saleId/preview — Return JSON for modal & browser print ──
router.get("/:saleId/preview", async (req, res) => {
  try {
    const saleId = Number(req.params.saleId);
    if (!saleId || isNaN(saleId)) return res.status(400).json({ error: "Yanlış satış ID" });
    const data = await getContractData(saleId);
    res.json(data);
  } catch (err: any) {
    res.status(404).json({ error: err.message || "Müqavilə məlumatı tapılmadı" });
  }
});

// ── GET /api/contracts/:saleId — Generate and download official .docx file ──────
router.get("/:saleId", async (req, res) => {
  try {
    const saleId = Number(req.params.saleId);
    if (!saleId || isNaN(saleId)) return res.status(400).json({ error: "Yanlış satış ID" });

    const data = await getContractData(saleId);
    const {
      contractNo, qaimeNo, contractDate, buyerFullName, idCard, fin,
      totalAmount, downPayment, remaining, monthlyPayment, installmentMonths,
      pricePerSqm, isCredit, finalPayDate, installStartDate, asset, seller
    } = data;

    const amt = (n: number) => `${n.toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${numToAz(n)}) AZN`;

    const sections: Paragraph[] = [
      // ── Title
      new Paragraph({
        children: [new TextRun({ text: "İLKİN MÜQAVİLƏ", bold: true, size: 28, font: "Times New Roman" })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120, line: 276 },
      }),
      para(asset.titleSub, { align: AlignmentType.CENTER, italic: true }),
      emptyLine(),

      // ── Preamble
      mixed([
        { text: "\tHazırkı ilkin müqavilə " },
        { text: contractDate, bold: true },
        { text: " tarixdə, Azərbaycan Respublikası, Naxçıvan Muxtar Respublikasının, Naxçıvan şəhərində, aşağıda göstərilən şəxslər arasında imzalanmışdır:" },
      ]),
      emptyLine(),

      // ── Seller
      mixed([
        { text: `\tNizamnaməsi əsasında fəaliyyət göstərən direktoru ${seller.director} şəxsində təmsil edilən, Azərbaycan Respublikasının qanunvericiliyinə uyğun yaradılmış və fəaliyyət göstərən ` },
        { text: seller.name, bold: true },
        { text: " (bundan sonra – " },
        { text: "Satıcı", bold: true },
        { text: ") bir tərəfdən və" },
      ]),
      emptyLine(),

      // ── Buyer
      mixed([
        { text: "\tAzərbaycan Respublikasının vətəndaşı " },
        { text: buyerFullName, bold: true },
        { text: " (Ş/V № " },
        { text: idCard, bold: true },
        { text: ", FİN: " },
        { text: fin, bold: true },
        { text: "), (bundan sonra – " },
        { text: "Alıcı", bold: true },
        { text: ")." },
      ]),
      emptyLine(),

      // ── NƏZƏRƏ ALARAQ
      para("NƏZƏRƏ ALARAQ Kİ,", { bold: true }),
      mixed([
        { text: "\tSatıcı " },
        { text: `${seller.address} ünvanda`, bold: true },
        { text: ` yerləşən və bu müqavilənin 1-ci maddəsində qeyd edilən ${asset.objectTypeDesc} (bundan sonra – Əmlak) tikintisi başa çatdıqdan sonra özgəninkiləşdirmək niyyətindədir; və` },
      ]),
      emptyLine(),
      para("\tAlıcı göstərilən Əmlakın üzərində alqı-satqı müqaviləsi bağlamaqla mülkiyyət hüququ əldə etməkdə maraqlıdır və bu məqsədlə Satıcı ilə ilkin razılıq əldə edilmişdir;"),
      emptyLine(),
      para("\tSatıcı hazırkı müqavilədə nəzərdə tutulmuş müddət ərzində Əmlakın satılması istiqamətində hər hansı üçüncü şəxslə heç bir danışıqlar aparmayacağına razılığını bildirmişdir;"),
      emptyLine(),
      para("\tTərəflər, bu ilkin müqavilənin mövzusunu təşkil edən Əmlakın alqı-satqısı barəsində əsas müqavilə bağlanarkən, həmin alqı-satqı müqaviləsinin əsas şərtlərinin bu ilkin müqavilədə nəzərdə tutulmuş əsas şərtlərinə uyğun olacağı barədə razılaşır;"),
      emptyLine(),
      para("Bununla Tərəflər aşağıdakılar barədə razılığa gəldilər:"),
      emptyLine(),

      // ══ SECTION 1 ══
      heading("MÜQAVİLƏNİN PREDMETİ", 2),
      emptyLine(),
      para(`\tBu müqaviləyə əsasən, Satıcı aşağıdakı cədvəldə göstərilmiş Əmlakın tikintisi başa çatdıqdan sonra bağlanacaq əsas alqı-satqı müqaviləsi əsasında Əmlakı Alıcıya təhvil vermək, Alıcı isə, bunun qarşılığında Satıcıya bu müqavilə ilə müəyyən edilmiş məbləği və eləcə də əsas alqı-satqı müqaviləsi imzalandığı vaxt ödənilməsi nəzərdə tutulan əsas pul məbləğin qalıq hissəsini ödəmək və bu müqavilə ilə nəzərdə tutulmuş bütün digər öhdəlikləri icra etməyi öhdəsinə götürür.`),
      emptyLine(),
    ];

    // ── Property Table
    const tableRows = [
      new TableRow({ children: [tableCell("Layihə:", true, 40), tableCell("Naxçıvan Residence", false, 60)] }),
      new TableRow({ children: [tableCell("Kompleks:", true, 40), tableCell(asset.buildingName || "—", false, 60)] }),
      new TableRow({ children: [tableCell("Blok / Ünvan:", true, 40), tableCell(asset.blockName || "—", false, 60)] }),
      new TableRow({ children: [tableCell("Mərtəbə:", true, 40), tableCell(asset.floor, false, 60)] }),
    ];

    if (asset.assetType === "apartment") {
      tableRows.push(
        new TableRow({ children: [tableCell("Otaqların sayı:", true, 40), tableCell(asset.rooms, false, 60)] }),
        new TableRow({ children: [tableCell("Mənzil №-si:", true, 40), tableCell(asset.number, false, 60)] })
      );
    } else {
      tableRows.push(
        new TableRow({ children: [tableCell("Fəaliyyət növü / Təyinatı:", true, 40), tableCell(asset.activityType, false, 60)] }),
        new TableRow({ children: [tableCell("Obyekt №-si:", true, 40), tableCell(asset.number, false, 60)] })
      );
    }

    tableRows.push(
      new TableRow({ children: [tableCell("Ümumi sahə (m²):", true, 40), tableCell(`${asset.area} m²`, false, 60)] }),
      new TableRow({ children: [tableCell("Satış qiyməti:", true, 40), tableCell(formatCurr(totalAmount), false, 60)] })
    );

    const propertyTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
    });

    sections.push(
      new Paragraph({
        children: [new TextRun({ text: "Cədvəl 1 (Əmlakın xarakteristikası)", bold: true, size: 22, font: "Times New Roman" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
      })
    );

    sections.push(emptyLine());
    sections.push(para("\t1.2\tƏmlakın ümumi sahəsinə daxili divarların və arakəsmələrin sahəsi, habelə qanunvericiliklə nəzərdə tutulmuş yardımçı sahələr də daxildir."));
    sections.push(emptyLine());

    // ══ SECTION 2 ══
    sections.push(heading("TƏRƏFLƏRİN HÜQUQ VƏ VƏZİFƏLƏRİ", 2));
    sections.push(emptyLine());
    sections.push(para("2.1\tSatıcının hüquqları:", { bold: true }));
    sections.push(para("2.1.1\tAlıcıdan Əmlakın dəyərini, Əmlaka aid aylıq kommunal haqları və Tərəflər arasında razılaşdırılmış istənilən digər xərclərin vaxtında ödənilməsini tələb etmək;"));
    sections.push(para("2.1.2\tAlıcı tərəfindən müqavilə şərtləri pozulduğu halda Alıcıdan vurulmuş ziyanın ödənilməsini tələb etmək;"));
    sections.push(para("2.1.3\tAlıcı tərəfindən bu müqavilə üzrə müəyyən edilmiş müddətlərdə ödənişlərin həyata keçirilməməsinə görə bu müqavilənin 3.4 maddəsində nəzərdə tutulmuş hüquqları həyata keçirmək;"));
    sections.push(para("2.1.4\tBu müqavilə üzrə öhdəliklər yerinə yetirildikdən sonra Tərəflər arasında əsas alqı-satqı müqaviləsinin bağlanılmasını tələb etmək."));
    sections.push(emptyLine());

    sections.push(para("2.2\tSatıcının vəzifələri:", { bold: true }));
    sections.push(para("2.2.1\tƏsas alqı-satqı müqaviləsi bağlananadək Əmlakın layihə üzrə tikinti-quraşdırma işlərini və xarici mühəndis kommunikasiya xətlərini təmin etmək."));
    sections.push(para("2.2.2\tSatıcı Əmlakın keyfiyyətinin qüvvədə olan texniki şərtlərin tələblərinə cavab verməsinə zəmanət verir."));
    sections.push(mixed([
      { text: "2.2.3\t\"Naxçıvan Residence\" layihəsinin ümumi iş qrafikinə uyğun olaraq tikinti işlərini başa çatdırıb, Əmlakı Alıcıya " },
      ...(isCredit ? [{ text: finalPayDate, bold: true }, { text: " tarixə qədər " }] : [{ text: "________________ " }]),
      { text: "əsas alqı-satqı müqaviləsi əsasında təhvil vermək, Alıcı isə əmlak üzrə olan ümumi borcunu tam ödəyərək bağlamaq öhdəliklərini qarşılıqlı olaraq qəbul edirlər." },
    ]));
    sections.push(emptyLine());

    sections.push(para("2.3\tAlıcının hüquqları:", { bold: true }));
    sections.push(para("2.3.1\tSatıcıdan bu müqavilə ilə müəyyən edilmiş öhdəliklərin vaxtında və keyfiyyətlə icrasını tələb etmək;"));
    sections.push(para("2.3.2\tƏmlakın dəyərini vaxtından əvvəl tam şəkildə ödəmək və əsas alqı-satqı müqaviləsinin bağlanmasını tələb etmək."));
    sections.push(emptyLine());

    sections.push(para("2.4\tAlıcının vəzifələri:", { bold: true }));
    sections.push(para("2.4.1\tƏmlakın dəyərinin ödənilməsini vaxtında və tam şəkildə yerinə yetirmək;"));
    sections.push(para("2.4.2\tƏmlak təhvil verildikdən sonra kommunal xərclərini müvafiq qaydada ödəmək;"));
    sections.push(para("2.4.3\tƏmlakdan müvafiq qanunvericiliklə müəyyən edilmiş təyinat üzrə istifadə etmək."));
    sections.push(emptyLine());

    // ══ SECTION 3 ══
    heading("MÜQAVİLƏ QİYMƏTİ VƏ HESABLAŞMA QAYDASI", 2),
    emptyLine(),
    sections.push(mixed([
      { text: "3.1\t" },
      { text: "Əmlakın 1 m² üçün qiymət " },
      { text: amt(pricePerSqm), bold: true },
      { text: " məbləğində razılaşdırılmışdır. Əmlakın yekun satış dəyəri " },
      { text: amt(totalAmount), bold: true },
      { text: " təşkil edir (bütün vergi və rüsumlar daxildir)." },
    ]));
    sections.push(emptyLine());

    if (isCredit) {
      sections.push(mixed([
        { text: "3.2\t" },
        { text: "Alıcı Əmlakın dəyərini bu müqavilə imzaladığı andan " },
        { text: amt(downPayment), bold: true },
        { text: " ilkin avans olaraq ödəyir. Qalıq borc məbləği " },
        { text: amt(remaining), bold: true },
        { text: ". Qalan məbləğ " },
        { text: installStartDate, bold: true },
        { text: " tarixdən etibarən " },
        { text: String(installmentMonths), bold: true },
        { text: " ay müddətində hər ay " },
        { text: amt(monthlyPayment), bold: true },
        { text: " olmaqla Satıcının hesabına ödənilir." },
      ]));
    } else {
      sections.push(mixed([
        { text: "3.2\t" },
        { text: "Alıcı Əmlakın ümumi dəyərini " },
        { text: amt(totalAmount), bold: true },
        { text: " tam olaraq bu müqavilə imzalandığı tarixdə birdəfəlik nağd və ya bank köçürməsi yolu ilə ödəyir." },
      ]));
    }
    sections.push(emptyLine());

    sections.push(para("3.3\tAlıcı bu müqavilə üzrə hüquq və vəzifələrini üçüncü şəxsə ötürmək istədikdə, bunu yalnız Satıcının rəsmi yazılı razılığı ilə həyata keçirə bilər."));
    sections.push(emptyLine());
    sections.push(para("3.4\tÖdəniş müddəti gecikdirildikdə hər gün üçün ödənilməli olan məbləğin 0.1%-i miqdarında cərimə tətbiq edilə bilər."));
    sections.push(emptyLine());

    // ══ SECTION 4 ══
    heading("MÜQAVİLƏNİN QÜVVƏYƏ MİNMƏSİ VƏ XİTAMI", 2);
    sections.push(emptyLine());
    sections.push(mixed([
      { text: "4.1\tBu müqavilə hər iki tərəf tərəfindən imzalandığı, yəni " },
      { text: contractDate, bold: true },
      { text: " tarixdən qüvvəyə minir və əsas alqı-satqı müqaviləsi bağlanana qədər qüvvədə qalır." },
    ]));
    sections.push(emptyLine());
    sections.push(para("4.2\tBu müqavilə eyni hüquqi qüvvəyə malik 2 (iki) nüsxədə tərtib edilmiş və tərəflərə təqdim olunmuşdur."));
    sections.push(emptyLine());
    sections.push(emptyLine());

    // ══ SIGNATURES ══
    heading("TƏRƏFLƏRİN REKVİZİTLƏRİ VƏ İMZALARI", 2);
    sections.push(emptyLine());

    const sigTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: "SATICI:", bold: true, size: 22, font: "Times New Roman" })], spacing: { after: 80 } }),
              new Paragraph({ children: [new TextRun({ text: seller.shortName, bold: true, size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
              new Paragraph({ children: [new TextRun({ text: seller.address, size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
              new Paragraph({ children: [new TextRun({ text: `Direktor: ${seller.director}`, size: 22, font: "Times New Roman" })], spacing: { after: 120 } }),
              new Paragraph({ children: [new TextRun({ text: "İmza: ______________________", size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
              new Paragraph({ children: [new TextRun({ text: "M.Y.", size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
            ],
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          }),
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: "ALICI:", bold: true, size: 22, font: "Times New Roman" })], spacing: { after: 80 } }),
              new Paragraph({ children: [new TextRun({ text: buyerFullName, bold: true, size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
              new Paragraph({ children: [new TextRun({ text: `Ş/V: ${idCard}`, size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
              new Paragraph({ children: [new TextRun({ text: `FİN: ${fin}`, size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
              new Paragraph({ children: [new TextRun({ text: `Ünvan: ${data.address || "Naxçıvan"}`, size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
              new Paragraph({ children: [new TextRun({ text: `Əlaqə: ${data.phone || "—"}`, size: 22, font: "Times New Roman" })], spacing: { after: 120 } }),
              new Paragraph({ children: [new TextRun({ text: "İmza: ______________________", size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
            ],
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          }),
        ]}),
      ],
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
            },
          },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Müqavilə №: ", bold: true, size: 22, font: "Times New Roman" }),
              new TextRun({ text: contractNo, bold: true, size: 22, font: "Times New Roman", underline: {} }),
              ...(qaimeNo ? [
                new TextRun({ text: "   |   Qaimə №: ", bold: true, size: 22, font: "Times New Roman" }),
                new TextRun({ text: qaimeNo, bold: true, size: 22, font: "Times New Roman", underline: {} }),
              ] : []),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 120 },
          }),
          ...sections.slice(0, 24),
          propertyTable,
          ...sections.slice(24),
          sigTable,
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const prefix = asset.assetType === "object" ? "muqavile-obyekt" : "muqavile-menzil";
    const filename = `${prefix}-${buyerFullName.replace(/\s+/g, "-")}-${contractNo}.docx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Müqavilə faylı yaradıla bilmədi" });
  }
});

export default router;
