import exam01Data from "@/content/exam/exam_01/exercises.json";
import exam02Data from "@/content/exam/exam_02/exercises.json";
import exam03Data from "@/content/exam/exam_03/exercises.json";

export type ExamExercise = {
  name: string;
  level: number;
  type: "program" | "function";
  subject: {
    assignment: string;
    files: string[];
    allowed: string[];
    description: string;
  };
  referenceCode: string;
  mainCode: string | null;
  testCases: { args: string[] }[];
};

export type ExamWeek = {
  id: string;
  title: string;
  description: string;
  levelCount: number;
  gradePerLevel: number;
  timeMinutes: number;
  exercises: ExamExercise[];
  exercisesByLevel: Record<number, ExamExercise[]>;
};

const rawExams: Record<string, Omit<ExamWeek, "exercisesByLevel">> = {
  exam_01: {
    id: "exam_01",
    title: "Exam Week 01",
    description:
      "Piscine exam week 1. Start with simple output programs and argument handling, progress to basic C functions.",
    levelCount: 8,
    gradePerLevel: ((0 + 1) / 8) * 100,
    timeMinutes: 240,
    exercises: exam01Data as ExamExercise[],
  },
  exam_02: {
    id: "exam_02",
    title: "Exam Week 02",
    description:
      "Piscine exam week 2. Covers string manipulation, numeric operations, binary bit manipulation.",
    levelCount: 8,
    gradePerLevel: ((0 + 1) / 8) * 100,
    timeMinutes: 240,
    exercises: exam02Data as ExamExercise[],
  },
  exam_03: {
    id: "exam_03",
    title: "Exam Week 03",
    description:
      "Piscine exam week 3. Advanced C functions and string patterns.",
    levelCount: 2,
    gradePerLevel: ((0 + 1) / 2) * 100,
    timeMinutes: 240,
    exercises: exam03Data as ExamExercise[],
  },
};

function buildExercisesByLevel(
  exercises: ExamExercise[],
): Record<number, ExamExercise[]> {
  const map: Record<number, ExamExercise[]> = {};
  for (const e of exercises) {
    if (!map[e.level]) map[e.level] = [];
    map[e.level].push(e);
  }
  for (const key of Object.keys(map)) {
    map[Number(key)].sort((a, b) => a.name.localeCompare(b.name));
  }
  return map;
}

export const examWeeks: Record<string, ExamWeek> = {
  exam_01: {
    ...rawExams.exam_01,
    exercisesByLevel: buildExercisesByLevel(rawExams.exam_01.exercises),
  },
  exam_02: {
    ...rawExams.exam_02,
    exercisesByLevel: buildExercisesByLevel(rawExams.exam_02.exercises),
  },
  exam_03: {
    ...rawExams.exam_03,
    exercisesByLevel: buildExercisesByLevel(rawExams.exam_03.exercises),
  },
};

export const lockedWeeks = {
  exam_04: {
    id: "exam_04",
    title: "Exam Week 04",
    description:
      "Advanced C: linked lists, recursion, complex algorithms. Coming soon — exercises are being prepared.",
    comingSoon: true,
  },
};

export function getExamWeekOrNull(id: string): ExamWeek | null {
  return examWeeks[id] || null;
}

export function getExamWeek(id: string): ExamWeek {
  const week = examWeeks[id];
  if (!week) throw new Error(`Unknown exam week: ${id}`);
  return week;
}

export function getRandomExercise(
  week: ExamWeek,
  level: number,
  exclude: string[] = [],
): ExamExercise {
  const pool = week.exercisesByLevel[level];
  if (!pool || pool.length === 0) {
    throw new Error(`No exercises at level ${level} for ${week.id}`);
  }
  const filtered = pool.filter((e) => !exclude.includes(e.name));
  if (filtered.length === 0) {
    throw new Error(
      `All exercises at level ${level} for ${week.id} have already been passed. ` +
        `Consider re-enabling passed exercises in settings.`,
    );
  }
  const idx = Math.floor(Math.random() * filtered.length);
  return filtered[idx];
}

export function getExercise(
  weekId: string,
  level: number,
  name: string,
): ExamExercise | null {
  const week = examWeeks[weekId];
  if (!week) return null;
  return (
    week.exercises.find((e) => e.level === level && e.name === name) || null
  );
}

export function getGradePerLevel(levelCount: number): number {
  return ((0 + 1) / levelCount) * 100;
}

export function getCurrentGrade(
  gradePerLevel: number,
  currentLevel: number,
): number {
  return gradePerLevel * currentLevel;
}

export function isExamComplete(accumulatedPoints: number): boolean {
  return accumulatedPoints >= 100;
}

export function getAvailableLevels(week: ExamWeek): number[] {
  return Object.keys(week.exercisesByLevel)
    .map(Number)
    .sort((a, b) => a - b);
}

export function isLevelAccessible(
  week: ExamWeek,
  level: number,
  currentLevel: number,
): boolean {
  return level <= currentLevel;
}
