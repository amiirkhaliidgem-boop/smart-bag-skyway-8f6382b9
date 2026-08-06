import { lostFoundSchema } from "@/lib/io/registry";
import { buildValidationReport } from "@/lib/io/import-service";
import { generateTemplate } from "@/lib/io/template";
import { toE164Eg, isEgMobile } from "@/lib/phone/egypt";
import { loadRegions, getRegions } from "@/lib/io/regions";

const regions = await loadRegions();
console.log("regions:", regions.map(r => r.name).join(", "));

const hdr = lostFoundSchema.fields.map(f => f.label);
console.log("TEMPLATE HEADERS:\n" + generateTemplate(lostFoundSchema).split("\n").slice(0,2).join("\n"));

const rows = [
  // 1 valid multi-tag + region
  ["QAT-001","Test One","01012345678","","","X1","MS","MS985","2026-06-18","JED","CAI","QAT9001,QAT9002,QAT9003","","Black","18","Hardshell","Home Delivery","1 Test St","Cairo","Normal","qa"],
  // 2 unknown region
  ["QAT-002","Test Two","01112345678","","","","MS","MS985","2026-06-18","JED","CAI","QAT9010","1","","","","Home Delivery","2 Test St","Atlantis","Normal",""],
  // 3 blank region
  ["QAT-003","Test Three","01212345678","","","","MS","MS985","2026-06-18","JED","CAI","QAT9011","1","","","","Home Delivery","3 Test St","","Normal",""],
  // 4 +20 number
  ["QAT-004","Test Four","+201012345678","","","","MS","MS985","2026-06-18","JED","CAI","QAT9012","1","","","","Home Delivery","4 St","Cairo","Normal",""],
  // 5 ten digits
  ["QAT-005","Test Five","0101234567","","","","MS","MS985","2026-06-18","JED","CAI","QAT9013","1","","","","Home Delivery","5 St","Giza","Normal",""],
  // 6 dashed
  ["QAT-006","Test Six","010-1234-5678","","","","MS","MS985","2026-06-18","JED","CAI","QAT9014","1","","","","Home Delivery","6 St","Giza","Normal",""],
  // 7 duplicate tag within file (QAT9002 used in row 1)
  ["QAT-007","Test Seven","01512345678","","","","MS","MS985","2026-06-18","JED","CAI","QAT9002","1","","","","Home Delivery","7 St","Cairo","Normal",""],
  // 8 duplicate tag against existing case (filled below)
  ["QAT-008","Test Eight","01512345679","","","","MS","MS985","2026-06-18","JED","CAI","__EXISTING__","1","","","","Home Delivery","8 St","Cairo","Normal",""],
];
const csv = [hdr.join(","), ...rows.map(r => r.map(v => /[",]/.test(v) ? `"${v.replaceAll('"','""')}"` : v).join(","))].join("\n");
const rep = buildValidationReport(lostFoundSchema, "qa.csv", csv);
console.log({total: rep.totalRows, accepted: rep.acceptedRows, rejected: rep.rejectedRows, warnings: rep.warningRows, dup: rep.duplicateRows, missingCols: rep.missingColumns, unknown: rep.unknownColumns});
for (const r of rep.rows) console.log(r.row, r.rejected ? "REJECT" : "ok", r.issues.map(i=>`${i.level}:${i.message}`).join(" | "));
console.log("E164:", toE164Eg("01012345678"), isEgMobile("+201012345678"), toE164Eg("+201012345678"));
