import general from "@/assets/covers/general.jpg";
import technology from "@/assets/covers/technology.jpg";
import business from "@/assets/covers/business.jpg";
import science from "@/assets/covers/science.jpg";
import law from "@/assets/covers/law.jpg";
import mathematics from "@/assets/covers/mathematics.jpg";
import literature from "@/assets/covers/literature.jpg";

const RULES: [RegExp, string][] = [
  [/code|program|software|algorithm|computer|data|python|java|web|ai\b|machine|network|cyber|tech|engineer/i, technology],
  [/business|market|finance|account|econom|manage|case study|startup|commerce/i, business],
  [/bio|chem|physic|science|medic|anatom|health|lab|research|nurs|pharm/i, science],
  [/law|legal|constitution|court|policy|govern|politic/i, law],
  [/math|calculus|algebra|statistic|geometry|equation|exam|jamb|waec|sat/i, mathematics],
  [/literature|english|history|novel|poem|poetry|language|philosoph|art|humanit/i, literature],
];

export function coverFor(text: string | null | undefined): string {
  const t = text ?? "";
  for (const [re, img] of RULES) if (re.test(t)) return img;
  return general;
}

export function PlanCover({ title, className = "" }: { title?: string | null; className?: string }) {
  return (
    <div className={`overflow-hidden bg-muted ${className}`}>
      <img src={coverFor(title)} alt="" loading="lazy" className="w-full h-full object-cover" />
    </div>
  );
}
