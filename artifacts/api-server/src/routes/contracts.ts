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

// ── Helper paragraph builders ─────────────────────────────────────────────────
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

function bullet(num: string, text: string, opts: { bold?: boolean } = {}): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: num + "\t", bold: true, size: 22, font: "Times New Roman" }),
      new TextRun({ text, bold: opts.bold, size: 22, font: "Times New Roman" }),
    ],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 0, after: convertInchesToTwip(3 / 72), line: 276 },
    indent: { left: convertInchesToTwip(30 / 72), hanging: convertInchesToTwip(30 / 72) },
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: "", size: 22, font: "Times New Roman" })], spacing: { before: 0, after: 0 } });
}

// ── Table helpers ─────────────────────────────────────────────────────────────
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

// ── Main contract generation route ────────────────────────────────────────────
router.get("/:saleId", async (req, res) => {
  const saleId = Number(req.params.saleId);

  // ── 1. Fetch sale
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId)).limit(1);
  if (!sale) return res.status(404).json({ error: "Satış tapılmadı" });
  if (sale.assetType !== "apartment") return res.status(400).json({ error: "Yalnız mənzil satışları üçün müqavilə yaradılır" });

  // ── 2. Fetch customer
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, sale.customerId)).limit(1);
  if (!customer) return res.status(404).json({ error: "Sakin tapılmadı" });

  // ── 3. Fetch apartment + block + building + quarter
  const [aptRow] = await db
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
  if (!aptRow) return res.status(404).json({ error: "Mənzil tapılmadı" });

  // ── 4. Fetch last installment date (for credit sales)
  let lastInstDate: Date | null = null;
  if (sale.saleType === "installment") {
    const installments = await db
      .select({ dueDate: installmentsTable.dueDate })
      .from(installmentsTable)
      .where(eq(installmentsTable.saleId, saleId));
    if (installments.length > 0) {
      lastInstDate = installments.reduce((max, i) =>
        i.dueDate > max ? i.dueDate : max, installments[0].dueDate);
    }
  }

  // ── 5. Build data variables
  const contractDate = formatDateAz(new Date(sale.saleDate));
  const buyerFullName = [customer.lastName, customer.firstName, customer.fatherName].filter(Boolean).join(" ");
  const idCard = customer.idCardNumber ?? "_______________";
  const fin = customer.fin ?? "_______";
  const totalAmount = Number(sale.totalAmount);
  const downPayment = Number(sale.downPayment ?? 0);
  const remaining = totalAmount - downPayment;
  const monthlyPayment = Number(sale.monthlyPayment ?? 0);
  const installmentMonths = Number(sale.installmentMonths ?? 0);
  const pricePerSqm = Number(sale.pricePerSqm ?? 0);
  const area = Number(aptRow.area);
  const contractNo = sale.contractNumber ?? "___";
  const isCredit = sale.saleType === "installment";
  const finalPayDate = lastInstDate ? formatDateAz(lastInstDate) : "________________";

  // ── 6. Build start date of installments (sale date)
  const installStartDate = formatDateAz(new Date(sale.saleDate));

  // ── 7. Helper for amount display: "1500 (min beş yüz) AZN"
  const amt = (n: number) => `${n.toLocaleString("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${numToAz(n)}) AZN`;

  // ══════════════════════════════════════════════════════════════════════════
  // Build the Word document
  // ══════════════════════════════════════════════════════════════════════════
  const sections: Paragraph[] = [

    // ── Title
    new Paragraph({
      children: [new TextRun({ text: "İLKİN MÜQAVİLƏ", bold: true, size: 28, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120, line: 276 },
    }),
    para("(Yaşayış kompleksində mənzil alqı-satqısına dair)", { align: AlignmentType.CENTER, italic: true }),
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
      { text: "\tNizamnaməsi əsasında fəaliyyət göstərən direktoru Bədəlov Həsən İlham oğlunun şəxsində təmsil edilən, Azərbaycan Respublikasının qanunvericiliyinə uyğun yaradılmış və fəaliyyət göstərən " },
      { text: "\"APF Construction\" Məhdud Məsuliyyətli Cəmiyyəti", bold: true },
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
      { text: ", _____________ tərəfindən ___ __________ ____-ci ildə verilmişdir, FİN: " },
      { text: fin, bold: true },
      { text: "), (bundan sonra -" },
      { text: "Alıcı", bold: true },
      { text: ")." },
    ]),
    emptyLine(),

    // ── NƏZƏRƏ ALARAQ
    para("NƏZƏRƏ ALARAQ Kİ,", { bold: true }),
    mixed([
      { text: "\tSatıcı " },
      { text: "Naxçıvan şəhəri 49-cu məhəllə, 1/7 ünvanda", bold: true },
      { text: " yerləşən və bu müqavilənin 1-ci maddəsində qeyd edilən mənzili (bundan sonra -Əmlak) tikintisi başa çatdıqdan sonra özgəninkiləşdirmək niyyətindədir; və" },
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
    para("\tBu müqaviləyə əsasən, Satıcı aşağıdakı cədvəldə göstərilmiş Əmlakın tikintisi başa çatdıqdan sonra bağlanacaq əsas alqı-satqı müqaviləsi əsasında Əmlakı Alıcıya təhvil vermək, Alıcı isə, bunun qarşılığında Satıcıya bu müqavilə ilə müəyyən edilmiş məbləği və eləcə də əsas alqı-satqı müqaviləsi imzalandığı vaxt ödənilməsi nəzərdə tutulan əsas pul məbləğin qalıq hissəsini ödəmək və bu müqavilə ilə nəzərdə tutulmuş bütün digər öhdəlikləri icra etməyi öhdəsinə götürür."),
    emptyLine(),
  ];

  // ── Cədvəl 1
  const propertyTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        tableCell("Layihə:", true, 40),
        tableCell("Naxçıvan Residence", false, 60),
      ]}),
      new TableRow({ children: [
        tableCell("Kompleks:", true, 40),
        tableCell(aptRow.buildingName ?? "—", false, 60),
      ]}),
      new TableRow({ children: [
        tableCell("Blok:", true, 40),
        tableCell(aptRow.blockName ?? "—", false, 60),
      ]}),
      new TableRow({ children: [
        tableCell("Mərtəbə:", true, 40),
        tableCell(String(aptRow.floor), false, 60),
      ]}),
      new TableRow({ children: [
        tableCell("Otaqların sayı:", true, 40),
        tableCell(String(aptRow.rooms), false, 60),
      ]}),
      new TableRow({ children: [
        tableCell("Mənzil №-si:", true, 40),
        tableCell(String(aptRow.number), false, 60),
      ]}),
      new TableRow({ children: [
        tableCell("Ümumi sahə (m²):", true, 40),
        tableCell(`${area} m²`, false, 60),
      ]}),
      new TableRow({ children: [
        tableCell("Mənzilin qiyməti:", true, 40),
        tableCell(formatCurr(totalAmount), false, 60),
      ]}),
    ],
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
  });

  sections.push(
    new Paragraph({
      children: [new TextRun({ text: "Cədvəl 1", bold: true, size: 22, font: "Times New Roman" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
    })
  );
  // Table pushed separately below

  sections.push(emptyLine());
  sections.push(para("\t1.2\tƏmlakın ümumi sahəsinə Əmlakın daxili divarlarının və arakəsmələrin sahəsi, dəhliz və eyvanların sahəsi, habelə yardımçı sahələr də daxildir."));
  sections.push(emptyLine());

  // ══ SECTION 2 ══
  sections.push(heading("TƏRƏFLƏRİN HÜQUQ VƏ VƏZİFƏLƏRİ", 2));
  sections.push(emptyLine());
  sections.push(para("2.1\tSatıcının hüquqları:", { bold: true }));
  sections.push(para("2.1.1\tAlıcıdan Əmlakın dəyərini, Əmlaka aid aylıq kommunal haqları və Tərəflər arasında razılaşdırılmış istənilən digər xərclərin vaxtında ödənilməsini və eləcə də bu müqavilə ilə nəzərdə tutulmuş bütün digər öhdəliklərinin tam və layiqincə yerinə yetirməsini tələb etmək;", { indent: 0 }));
  sections.push(para("2.1.2\tAlıcı tərəfindən müqavilə şərtləri pozulduğu halda Alıcıdan vurulmuş ziyanın ödənilməsini tələb etmək;"));
  sections.push(para("2.1.3\tAlıcı tərəfindən bu müqavilə üzrə müəyyən edilmiş müddətlərdə ödənişlərin həyata keçirilməməsinə və digər öhdəliklərin yerinə yetirilməməsinə görə bu müqavilənin 3.4 maddəsində nəzərdə tutulmuş hüquqları həyata keçirmək;"));
  sections.push(para("2.1.4\tBu müqavilə üzrə öhdəliklər yerinə yetirildikdən sonra Tərəflər arasında əsas alqı-satqı müqaviləsinin bağlanılmasını Alıcıdan tələb etmək;"));
  sections.push(para("2.1.5\tƏsas alqı-satqı müqaviləsinin bağlanması ilə əlaqədar olan xərclərin ödənilməsini Alıcıdan tələb etmək;"));
  sections.push(para("2.1.6\tQanunvericiliklə nəzərdə tutulmuş digər hüquqlarını tətbiq etmək."));
  sections.push(emptyLine());
  sections.push(para("2.2\tSatıcının vəzifələri:", { bold: true }));
  sections.push(para("2.2.1\tƏsas alqı-satqı müqaviləsi bağlananadək aşağıdakıları təmin etmək: Əmlaka giriş dəmir qapısı quraşdırmaq; pəncərələrin qoyulmasını və şüşələnməsini təmin etmək; liftləri quraşdırmaq; pilləkən meydançası və marşlarını üzlük plitələrlə üzləmək; mərtəbələrdə elektrik lövhələri quraşdırmaq; xarici mühəndis xətləri və qurğularını çəkmək; məhəllədaxili abadlıq işlərini həyata keçirmək."));
  sections.push(para("2.2.2\tSatıcı Əmlakın keyfiyyətinin qüvvədə olan texniki şərtlərin tələblərinə cavab verməsinə zəmanət verir."));
  sections.push(para("2.2.3\tSatıcı Əmlakı müvafiq qaydada Alıcıya sonradan bağlanacaq əsas alqı-satqı müqaviləsi əsasında təhvil verəcəkdir."));
  sections.push(mixed([
    { text: "2.2.4\t\"Naxçıvan Residence\" layihəsinin ümumi iş qrafikinə uyğun olaraq tikinti işlərini başa çatdırıb, Əmlakı Alıcıya " },
    ...(isCredit ? [{ text: finalPayDate, bold: true }, { text: " tarixə qədər " }] : [{ text: "________________ " }]),
    { text: "əsas alqı-satqı müqaviləsi əsasında təhvil vermək, Alıcı isə mənzil üzrə olan ümumi borcunu tam ödəyərək bağlamaq öhdəliklərini qarşılıqlı olaraq qəbul edirlər." },
  ]));
  sections.push(emptyLine());
  sections.push(para("2.3\tAlıcının hüquqları:", { bold: true }));
  sections.push(para("2.3.1\tSatıcıdan bu müqavilənin 2.2-ci maddəsi ilə müəyyən edilmiş öhdəliklərin vaxtında icrasını tələb etmək;"));
  sections.push(para("2.3.2\tBu müqavilə üzrə öhdəliklər yerinə yetirildikdən sonra Tərəflər arasında əsas alqı-satqı müqaviləsinin bağlanmasını Satıcıdan tələb etmək;"));
  sections.push(para("2.3.3\tSatıcıdan Əmlakı razılaşdırılmış şərtlərə uyğun şəkildə təhvil almaq;"));
  sections.push(para("2.3.4\tƏmlakın dəyərini vaxtından əvvəl tam şəkildə ödəmək."));
  sections.push(emptyLine());
  sections.push(para("2.4\tAlıcının vəzifələri:", { bold: true }));
  sections.push(para("2.4.1\tƏmlakın dəyərinin ödənilməsi və digər öhdəlikləri vaxtında və tam şəkildə yerinə yetirmək;"));
  sections.push(para("2.4.2\tBu müqavilə ilə şərtləndirilmiş əsas alqı-satqı müqaviləsinin bağlanmasını yubatmadan həyata keçirmək;"));
  sections.push(para("2.4.3\tSatıcıdan asılı olmayan hallarda yaranacaq hər hansı bir dəyişiklik nəticəsinde yeni hüquqi statusu qəbul etmək;"));
  sections.push(para("2.4.4\tƏmlaka mülkiyyət hüququnun öz adına rəsmiləşdirilməsini öz qüvvə və vəsaiti hesabına təmin etmək;"));
  sections.push(para("2.4.5\tSatıcının razılığı olmadan bu müqavilənin qüvvədə olduğu müddət ərzində Əmlakı başqa şəxslərin sahibliyinə verməmək;"));
  sections.push(para("2.4.6\tAlıcı bu müqavilə ilə bağlı hüquq və vəzifələrini üçüncü şəxsə ötürmək qərarına gəldikdə, müqavilənin 3.3-cü maddəsində nəzərdə tutulan inzibati xərci ödəmək;"));
  sections.push(para("2.4.7\tƏmlak təhvil verildikdən sonra hər hansı təmir-quraşdırma işlərini, Kompleksin idarəetməsini həyata keçirən qurumla razılaşdıraraq, tikinti norma və qaydalarına uyğun həyata keçirmək;"));
  sections.push(para("2.4.8\tTəmir işlərini həyata keçirərkən sakinlərin rahatlığını pozmamaq məqsədilə, həmin işləri səhər saat 10:00-dan axşam saat 19:00-dək apara bilər. İstirahət günlərində həmin işlər aparıla bilməz."));
  sections.push(para("2.4.9\tƏmlakdan müvafiq qanunvericiliklə müəyyən edilmiş təyinat üzrə istifadə etmək."));
  sections.push(para("2.4.10\tSatıcı tərəfindən Əmlak təhvil verilən andan su, qaz, elektrik enerjisinin istifadəsi nəticəsinde yaranmış kommunal xərclərini müvafiq qurumlara ödəmək."));
  sections.push(emptyLine());

  // ══ SECTION 3 ══
  sections.push(heading("MÜQAVİLƏ QİYMƏTİ VƏ HESABLAŞMA QAYDASI", 2));
  sections.push(emptyLine());

  sections.push(mixed([
    { text: "3.1\t" },
    { text: "Əmlakın 1 m² üçün qiymət " },
    { text: amt(pricePerSqm), bold: true },
    { text: " məbləğində müəyyən edilir. Əmlakın dəyəri " },
    { text: amt(totalAmount), bold: true },
    { text: " təşkil edir (ƏDV daxil). Ümumi qiymətə bütün müvafiq vergilər, rüsumlar, icazə və lisenziyalar daxildir." },
  ]));
  sections.push(emptyLine());

  if (isCredit) {
    sections.push(mixed([
      { text: "3.2\t" },
      { text: "Alıcı Əmlakın dəyərini bu müqavilə imzaladığı andan " },
      { text: amt(downPayment), bold: true },
      { text: " avans olaraq ödəyir, qalıq məbləğ " },
      { text: amt(remaining), bold: true },
      { text: ". Qalan məbləği " },
      { text: installStartDate, bold: true },
      { text: " tarixdən etibarən " },
      { text: String(installmentMonths), bold: true },
      { text: " ay müddətində hər ay " },
      { text: amt(monthlyPayment), bold: true },
      { text: " olmaqla ödəməyi öhdəsinə götürür." },
    ]));
  } else {
    sections.push(mixed([
      { text: "3.2\t" },
      { text: "Alıcı Əmlakın dəyərini " },
      { text: amt(totalAmount), bold: true },
      { text: " tam olaraq bu müqavilə imzalandığı tarixdə nağd ödəyir." },
    ]));
  }

  sections.push(emptyLine());
  sections.push(para("3.3\tAlıcı bu müqavilə ilə nəzərdə tutulmuş hüquq və vəzifələrini hər hansı üçüncü şəxsə ötürmək qərarına gəldikdə, Satıcı ilə razılaşdırmalıdır. Hüquqların ötürülməsi razılaşdırıldığı halda, Satıcı Alıcıdan inzibati xərclərin əvəzini almaqla, hüquqların digər şəxsə ötürülməsini müvafiq qaydada həyata keçirir."));
  sections.push(emptyLine());
  sections.push(para("3.4\tAlıcı tərəfindən ödəniş müddəti keçdikdən sonra hər gecikdirilmiş gün üçün ödənilməli olan məbləğin 0.1%-i miqdarında cərimə tətbiq edilir. Alıcı ödəniş öhdəliklərini 3 (üç) ay ardıcıl yerinə yetirməzsə, Satıcı müqaviləni birtərəfli qaydada ləğv etmək hüququna malikdir. Bu halda Alıcıya ödənilmiş məbləğin 85%-i qaytarılır, 15%-i isə cərimə kimi tutulur."));
  sections.push(emptyLine());

  // ══ SECTION 4 ══
  sections.push(heading("MÜQAVİLƏNİN QÜVVƏYƏ MİNMƏSİ VƏ XITAMI", 2));
  sections.push(emptyLine());
  sections.push(mixed([
    { text: "4.1\tBu müqavilə hər iki tərəf tərəfindən imzalandığı, yəni " },
    { text: contractDate, bold: true },
    { text: " tarixdən qüvvəyə minir." },
  ]));
  sections.push(emptyLine());
  sections.push(mixed([
    { text: "4.2\tBu müqavilə " },
    ...(isCredit
      ? [{ text: finalPayDate, bold: true }, { text: " tarixə qədər, yəni əsas alqı-satqı müqaviləsi bağlanana qədər qüvvədə olur." }]
      : [{ text: "əsas alqı-satqı müqaviləsi bağlanana qədər qüvvədə olur." }]
    ),
  ]));
  sections.push(emptyLine());
  sections.push(para("4.3\tMüqavilə Tərəflərin qarşılıqlı razılığı ilə ləğv edilə bilər. Müqavilə Alıcının təşəbbüsü ilə ləğv edildikdə, 3.4-cü maddədə göstərilən qaydalar tətbiq edilir."));
  sections.push(emptyLine());
  sections.push(para("4.4\tBu müqavilə ilə tənzimlənməyən hallarda Azərbaycan Respublikasının qüvvədə olan qanunvericiliyi tətbiq edilir. Tərəflər arasında mübahisələr danışıqlar yolu ilə, razılığa gəlinmədikdə isə məhkəmə qaydasında həll edilir."));
  sections.push(emptyLine());
  sections.push(para("4.5\tBu müqavilə eyni hüquqi qüvvəyə malik 2 (iki) nüsxədə tərtib edilib, hər bir Tərəfə birer nüsxə verilmişdir."));
  sections.push(emptyLine());
  sections.push(emptyLine());

  // ══ SIGNATURES ══
  sections.push(heading("TƏRƏFLƏRİN REKVİZİTLƏRİ VƏ İMZALARI", 2));
  sections.push(emptyLine());

  const sigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        new TableCell({
          children: [
            new Paragraph({ children: [new TextRun({ text: "SATICI:", bold: true, size: 22, font: "Times New Roman" })], spacing: { after: 80 } }),
            new Paragraph({ children: [new TextRun({ text: "\"APF Construction\" MMC", size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
            new Paragraph({ children: [new TextRun({ text: "Naxçıvan şəhəri, 49-cu məhəllə, 1/7", size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
            new Paragraph({ children: [new TextRun({ text: "Direktor: Bədəlov Həsən İlham oğlu", size: 22, font: "Times New Roman" })], spacing: { after: 120 } }),
            new Paragraph({ children: [new TextRun({ text: "İmza: ______________________", size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
            new Paragraph({ children: [new TextRun({ text: "M.Y.", size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
          ],
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        }),
        new TableCell({
          children: [
            new Paragraph({ children: [new TextRun({ text: "ALICI:", bold: true, size: 22, font: "Times New Roman" })], spacing: { after: 80 } }),
            new Paragraph({ children: [new TextRun({ text: buyerFullName, size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
            new Paragraph({ children: [new TextRun({ text: `Ş/V: ${idCard}`, size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
            new Paragraph({ children: [new TextRun({ text: `FİN: ${fin}`, size: 22, font: "Times New Roman" })], spacing: { after: 120 } }),
            new Paragraph({ children: [new TextRun({ text: "İmza: ______________________", size: 22, font: "Times New Roman" })], spacing: { after: 60 } }),
          ],
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        }),
      ]}),
    ],
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
  });

  // ── Build document
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
        // Contract number line
        new Paragraph({
          children: [
            new TextRun({ text: "Müqavilə №: ", bold: true, size: 22, font: "Times New Roman" }),
            new TextRun({ text: contractNo, bold: true, size: 22, font: "Times New Roman", underline: {} }),
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 120 },
        }),
        ...sections.slice(0, 24), // title through "Cədvəl 1" heading
        propertyTable,
        ...sections.slice(24),   // rest
        sigTable,
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `muqavile-${buyerFullName.replace(/\s+/g, "-")}-${contractNo}.docx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(buffer);
});

export default router;
