import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = "/tmp/42_exam/.subjects/PISCINE_PART";
const DEST = path.resolve(__dirname, "..", "content", "exam");
const EXAM_WEEKS = ["exam_01", "exam_02", "exam_03"];

function parseSubject(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const result = { assignment: "", files: [], allowed: [], description: "" };

  const headerEnd = lines.findIndex(
    (l) => l.startsWith("---") || l === ""
  );

  let headerLines = headerEnd > 0 ? lines.slice(0, headerEnd) : lines.slice(0, 4);

  for (const line of headerLines) {
    const mName = line.match(/^Assignment\s*name\s*:\s*(.+)$/i);
    if (mName) result.assignment = mName[1].trim();

    const mFiles = line.match(/^Expected\s*files?\s*:\s*(.+)$/i);
    if (mFiles)
      result.files = mFiles[1]
        .split(/[,\s]+/)
        .map((f) => f.trim())
        .filter(Boolean);

    const mAllowed = line.match(/^Allowed\s*functions?\s*:\s*(.+)$/i);
    if (mAllowed) {
      const raw = mAllowed[1].trim();
      if (raw === "None" || raw === "-" || raw === "") {
        result.allowed = [];
      } else {
        result.allowed = raw
          .split(/[,\s]+/)
          .map((f) => f.trim())
          .filter(Boolean);
      }
    }
  }

  const bodyStart = headerEnd > 0 ? headerEnd + 1 : 4;
  result.description = lines
    .slice(bodyStart)
    .filter((l) => l !== "" || lines.indexOf(l) > bodyStart)
    .join("\n")
    .trim();

  return result;
}

const LCM_SUBJECT = {
  assignment: "lcm",
  files: ["lcm.c"],
  allowed: [],
  description:
    "Write a function who takes two unsigned int as parameters and returns the computed LCM of those two numbers.\n\nLCM (Lowest Common Multiple) of two non-zero integers is the smallest positive integer divisible by the both integers.\n\nYour function must be declared as follows:\n\nunsigned int\tlcm(unsigned int a, unsigned int b);",
};

function findRefC(exDir, dirName) {
  const entries = fs.readdirSync(exDir);
  const candidates = entries.filter(
    (f) =>
      f.endsWith(".c") &&
      !f.endsWith("_withmain.c") &&
      !f.endsWith("_recursive.c") &&
      f !== "main.c" &&
      !f.startsWith("check") &&
      f !== "is.c"
  );

  if (candidates.length === 0) return null;

  const exact = candidates.find(
    (c) => c.replace(".c", "") === dirName
  );
  if (exact) return exact;

  return candidates[0];
}

function extractTestCases(testerPath) {
  const content = fs.readFileSync(testerPath, "utf-8");
  const cases = [];

  const inlineRegex = /\.\/source\s+(.*?)\s*\|/g;
  let match;
  while ((match = inlineRegex.exec(content)) !== null) {
    const argsRaw = match[1].trim();
    const args = parseArgs(argsRaw);
    cases.push(args);
  }

  if (cases.length === 0) {
    const delegatedRegex =
      /bash\s+\.system\/auto_correc_(?:main|program)\.sh\s+\$\w+\s+\$\w+[ \t]*(.*?)(?:\n|$)/g;
    while ((match = delegatedRegex.exec(content)) !== null) {
      const argsRaw = match[1].trim();
      if (argsRaw === "") {
        cases.push([]);
      } else {
        const args = parseArgs(argsRaw);
        cases.push(args);
      }
    }
  }

  const unique = [];
  const seen = new Set();
  for (const c of cases) {
    const key = JSON.stringify(c);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  return unique;
}

function parseArgs(raw) {
  if (raw === "") return [];
  const args = [];
  let i = 0;

  while (i < raw.length) {
    while (i < raw.length && raw[i] === " ") i++;
    if (i >= raw.length) break;

    if (raw[i] === '"') {
      i++;
      let val = "";
      while (i < raw.length && raw[i] !== '"') {
        if (raw[i] === "\\" && i + 1 < raw.length) {
          val += raw[i + 1];
          i += 2;
        } else {
          val += raw[i];
          i++;
        }
      }
      i++;
      args.push(val);
    } else if (raw[i] === "'") {
      i++;
      let val = "";
      while (i < raw.length && raw[i] !== "'") {
        val += raw[i];
        i++;
      }
      i++;
      args.push(val);
    } else {
      let val = "";
      while (i < raw.length && raw[i] !== " " && raw[i] !== '"' && raw[i] !== "'") {
        val += raw[i];
        i++;
      }
      args.push(val);
    }
  }

  return args;
}

function extractExercises(src) {
  const exercises = [];

  for (const weekName of EXAM_WEEKS) {
    const weekPath = path.join(src, weekName);
    if (!fs.existsSync(weekPath)) continue;

    const levelDirs = fs
      .readdirSync(weekPath)
      .filter((d) => /^\d+$/.test(d))
      .map(Number)
      .sort((a, b) => a - b);

    for (const lvl of levelDirs) {
      const lvlPath = path.join(weekPath, String(lvl));
      const exDirs = fs
        .readdirSync(lvlPath)
        .filter((d) => !d.startsWith("."));

      for (const exName of exDirs) {
        const exDir = path.join(lvlPath, exName);
        const testerPath = path.join(exDir, "tester.sh");
        const subjectPath = path.join(exDir, "attachment", "subject.en.txt");
        const mainPath = path.join(exDir, "main.c");

        if (!fs.existsSync(subjectPath)) continue;
        if (!fs.existsSync(testerPath)) continue;

        const refCName = findRefC(exDir, exName);
        if (!refCName) {
          console.warn(`  SKIP ${weekName}/L${lvl}/${exName}: no reference .c`);
          continue;
        }

        const refPath = path.join(exDir, refCName);
        const subjectRaw = fs.readFileSync(subjectPath, "utf-8");

        let subject;
        if (exName === "lcm") {
          subject = LCM_SUBJECT;
        } else {
          subject = parseSubject(subjectRaw);
        }
        if (!subject.assignment) subject.assignment = exName;

        const mainExists = fs.existsSync(mainPath);
        const exType = mainExists ? "function" : "program";

        const testCases = extractTestCases(testerPath);
        if (testCases.length === 0) {
          console.warn(`  SKIP ${weekName}/L${lvl}/${exName}: no test cases extracted`);
          continue;
        }

        const referenceCode = fs.readFileSync(refPath, "utf-8");
        const mainCode = mainExists ? fs.readFileSync(mainPath, "utf-8") : null;

        exercises.push({
          name: exName,
          level: lvl,
          type: exType,
          subject,
          referenceCode,
          mainCode,
          testCases: testCases.map((args) => ({ args })),
          _refFile: refCName,
          _week: weekName,
        });
      }
    }
  }

  return exercises;
}

const exercises = extractExercises(SOURCE);
console.log(`Extracted ${exercises.length} exercises total\n`);

for (const weekName of EXAM_WEEKS) {
  const weekExs = exercises.filter((e) => e._week === weekName);
  if (weekExs.length === 0) continue;

  const weekDir = path.join(DEST, weekName);
  const refDir = path.join(weekDir, "references");
  fs.mkdirSync(refDir, { recursive: true });

  const out = weekExs.map(({ _refFile, _week, ...ex }) => ex);
  const outPath = path.join(weekDir, "exercises.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`${weekName}: ${out.length} exercises → ${outPath}`);

  for (const ex of weekExs) {
    const srcRef = path.join(SOURCE, weekName, String(ex.level), ex.name, ex._refFile);
    const dstRef = path.join(refDir, `${ex.name}.c`);
    if (fs.existsSync(srcRef)) {
      fs.copyFileSync(srcRef, dstRef);
    }
    const srcMain = path.join(SOURCE, weekName, String(ex.level), ex.name, "main.c");
    const dstMain = path.join(refDir, `${ex.name}_main.c`);
    if (fs.existsSync(srcMain)) {
      fs.copyFileSync(srcMain, dstMain);
    }
    const srcSubj = path.join(
      SOURCE,
      weekName,
      String(ex.level),
      ex.name,
      "attachment",
      "subject.en.txt"
    );
    const dstSubj = path.join(refDir, `${ex.name}_subject.txt`);
    if (fs.existsSync(srcSubj)) {
      fs.copyFileSync(srcSubj, dstSubj);
    }
  }

  const levels = [...new Set(weekExs.map((e) => e.level))].sort((a, b) => a - b);
  const exByLvl = {};
  for (const l of levels) {
    exByLvl[l] = weekExs
      .filter((e) => e.level === l)
      .map((e) => e.name)
      .sort();
  }
  console.log(`  Levels: ${levels.join(", ")}`);
  for (const l of levels) {
    console.log(`    Level ${l}: ${exByLvl[l].length} exercises — ${exByLvl[l].join(", ")}`);
  }
  console.log("");
}

console.log("Done. Reference files copied to content/exam/*/references/");
