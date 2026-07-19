/**
 * DestinationGallery — filterable destination grid.
 * - Region tab bar with sliding active indicator (Framer layoutId)
 * - Staggered fade-and-scale filter animation
 * - Card hover: lift + image zoom + gradient overlay + tagline slide-up
 * - Mobile: horizontal snap-scroll carousel
 * - RTL-aware, prefers-reduced-motion safe
 */
import { useState, useId } from "react";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";
import { useTranslation } from "@/providers/translation-context";

/* ── Types ─────────────────────────────────────────────────────────── */
type Region = "all" | "central" | "western" | "southern" | "eastern" | "northern";

interface Destination {
  id: string;
  nameEn: string;
  nameAr: string;
  taglineEn: string;
  taglineAr: string;
  region: Exclude<Region, "all">;
  imageUrl: string;
  alt: string;
  fallback: string;
}

/* ── Destination data ──────────────────────────────────────────────── */
const DESTINATIONS: Destination[] = [
  /* ── Central ── */
  {
    id: "riyadh",
    nameEn: "Riyadh",
    nameAr: "الرياض",
    taglineEn: "Diriyah, Kingdom Centre & Wadi Hanifah",
    taglineAr: "الدرعية، برج المملكة ووادي حنيفة",
    region: "central",
    imageUrl: "https://plus.unsplash.com/premium_photo-1697729683785-adfae2f6564b?w=600&q=80&auto=format&fit=crop",
    alt: "Kingdom Centre Tower dominating the Riyadh skyline at dusk, Saudi Arabia",
    fallback: "#0A0E16",
  },
  {
    id: "edge-world",
    nameEn: "Edge of the World",
    nameAr: "حافة العالم",
    taglineEn: "A 300 m cliff overlooking an ancient sea bed",
    taglineAr: "جرف بارتفاع ٣٠٠ متر يُطلّ على قاع بحر قديم",
    region: "central",
    imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80&auto=format&fit=crop",
    alt: "Dramatic sandstone escarpment cliffs at Jebel Fihrayn, Edge of the World near Riyadh",
    fallback: "#0D1520",
  },
  {
    id: "diriyah",
    nameEn: "Diriyah",
    nameAr: "الدرعية",
    taglineEn: "UNESCO At-Turaif — birthplace of the Saudi state",
    taglineAr: "الدرعية مهد الدولة السعودية — موروث ثقافي عالمي",
    region: "central",
    imageUrl: "https://houseofsaud.com/wp-content/uploads/2026/03/diriyah-travel-guide-najdi-fortress-2026.jpg",
    alt: "Traditional Najdi mud-brick fortress walls of At-Turaif UNESCO World Heritage Site in Diriyah",
    fallback: "#1A0D05",
  },
  {
    id: "qassim",
    nameEn: "Buraydah & Unaizah",
    nameAr: "بريدة وعنيزة",
    taglineEn: "Qassim dates, camel markets, and desert heritage",
    taglineAr: "تمور القصيم، أسواق الإبل والتراث الصحراوي",
    region: "central",
    imageUrl: "https://ramaarya.blog/wp-content/uploads/2026/03/saudi-arabia-buraidah-camel-market-1.jpg",
    alt: "Camels gathered at the famous Buraydah camel market in Qassim, Saudi Arabia",
    fallback: "#1A0F06",
  },
  {
    id: "ushaiqer",
    nameEn: "Ushaiqer Heritage Village",
    nameAr: "أشيقر",
    taglineEn: "Perfectly preserved mud-brick labyrinthine village",
    taglineAr: "قرية متاهية من الطين محفوظة بشكل مثالي",
    region: "central",
    imageUrl: "https://ramaarya.blog/wp-content/uploads/2026/03/saudi-arabia-heritage-village-ushaiqer-1.jpg",
    alt: "Narrow winding alleyways between ancient mud-brick buildings of Ushaiqer Heritage Village, Saudi Arabia",
    fallback: "#1A1208",
  },
  {
    id: "shaqra",
    nameEn: "Shaqra",
    nameAr: "شقراء",
    taglineEn: "Golden limestone old town with ornate carved doors",
    taglineAr: "بلدة قديمة من الحجر الكلسي الذهبي بأبواب منحوتة",
    region: "central",
    imageUrl: "https://images.pexels.com/photos/30296714/pexels-photo-30296714/free-photo-of-traditional-mud-brick-architecture-in-sunlit-village.jpeg?auto=compress&cs=tinysrgb&w=600",
    alt: "Sunlit traditional mud-brick architecture with ornate details in a Najd heritage village",
    fallback: "#18120A",
  },

  /* ── Western ── */
  {
    id: "jeddah",
    nameEn: "Jeddah",
    nameAr: "جدة",
    taglineEn: "Al-Balad UNESCO district, Corniche & King Fahd Fountain",
    taglineAr: "حي البلد التراثي، الكورنيش ونافورة الملك فهد",
    region: "western",
    imageUrl: "https://houseofsaud.com/wp-content/uploads/2026/04/jeddah-coral-al-balad-overview-1.jpg",
    alt: "Traditional coral stone buildings with wooden Rawasheen balconies in Al-Balad historic district, Jeddah",
    fallback: "#12100A",
  },
  {
    id: "makkah",
    nameEn: "Makkah",
    nameAr: "مكة المكرمة",
    taglineEn: "Masjid al-Haram — holiest site in Islam",
    taglineAr: "المسجد الحرام — أقدس البقاع في الإسلام",
    region: "western",
    imageUrl: "https://images.unsplash.com/photo-1537031834973-8de914ba6f25?w=600&q=80&auto=format&fit=crop",
    alt: "Aerial view of Masjid al-Haram and the Kaaba surrounded by worshippers in Makkah",
    fallback: "#0A0E16",
  },
  {
    id: "madinah",
    nameEn: "Madinah",
    nameAr: "المدينة المنورة",
    taglineEn: "Al-Masjid an-Nabawi and Quba Mosque",
    taglineAr: "المسجد النبوي الشريف ومسجد قباء",
    region: "western",
    imageUrl: "https://images.pexels.com/photos/11259857/pexels-photo-11259857.jpeg?auto=compress&cs=tinysrgb&w=600&h=450&fit=crop",
    alt: "Illuminated minarets and green dome of Al-Masjid an-Nabawi glowing against the night sky in Madinah",
    fallback: "#081410",
  },
  {
    id: "taif",
    nameEn: "Taif",
    nameAr: "الطائف",
    taglineEn: "City of roses, cable cars, and cool mountain air",
    taglineAr: "مدينة الورود والتلفريك والهواء الجبلي البارد",
    region: "western",
    imageUrl: "https://images.unsplash.com/photo-1490750967868-88df5691cc08?w=600&q=80&auto=format&fit=crop",
    alt: "Pink rose garden in full bloom with mountain backdrop in Taif, Saudi Arabia",
    fallback: "#1A0815",
  },
  {
    id: "alula",
    nameEn: "AlUla",
    nameAr: "العُلا",
    taglineEn: "Hegra, Elephant Rock, Maraya — a living museum",
    taglineAr: "الحِجر، صخرة الفيل، مرايا — متحف حي",
    region: "western",
    imageUrl: "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=600&q=80&auto=format&fit=crop",
    alt: "Towering Nabataean rock-cut tombs at sunset in Hegra, AlUla, Saudi Arabia",
    fallback: "#1A1008",
  },
  {
    id: "yanbu",
    nameEn: "Yanbu",
    nameAr: "ينبع",
    taglineEn: "Red Sea diving, coral gardens, and waterfront city",
    taglineAr: "غوص البحر الأحمر وحدائق المرجان والواجهة البحرية",
    region: "western",
    imageUrl: "https://www.agoda.com/wp-content/uploads/2019/11/Red-coral-Red-Sea-diving-in-Saudi-Arabia.jpg",
    alt: "Vibrant red coral reef with colourful fish in clear Red Sea waters off Yanbu, Saudi Arabia",
    fallback: "#031822",
  },
  {
    id: "rabigh",
    nameEn: "Rabigh",
    nameAr: "رابغ",
    taglineEn: "Quiet Red Sea beaches away from the crowds",
    taglineAr: "شواطئ هادئة على البحر الأحمر بعيداً عن الازدحام",
    region: "western",
    imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80&auto=format&fit=crop",
    alt: "Quiet sandy beach with gentle waves and clear blue water at Rabigh on the Red Sea",
    fallback: "#031A20",
  },

  /* ── Southern ── */
  {
    id: "abha",
    nameEn: "Abha",
    nameAr: "أبها",
    taglineEn: "Gateway to the emerald Aseer highlands",
    taglineAr: "بوابة مرتفعات عسير الزمردية",
    region: "southern",
    imageUrl: "https://images.pexels.com/photos/36772107/pexels-photo-36772107/free-photo-of-scenic-view-of-tanomah-aseer-province-saudi-arabia.jpeg?auto=compress&cs=tinysrgb&w=600",
    alt: "Scenic misty green highland panorama of Tanomah in Aseer Province, Saudi Arabia",
    fallback: "#0A1A0E",
  },
  {
    id: "soudah",
    nameEn: "Soudah",
    nameAr: "السودة",
    taglineEn: "Saudi Arabia's highest peak with a cable car view",
    taglineAr: "أعلى قمة في المملكة مع مشهد التلفريك",
    region: "southern",
    imageUrl: "https://images.pexels.com/photos/36673466/pexels-photo-36673466/free-photo-of-traditional-architecture-in-saudi-arabia-high-mountains.jpeg?auto=compress&cs=tinysrgb&w=600",
    alt: "Traditional stone architecture perched on the high mountain ridges of the Aseer region near Soudah",
    fallback: "#0A1810",
  },
  {
    id: "rijal-almaa",
    nameEn: "Rijal Almaa",
    nameAr: "رجال ألمع",
    taglineEn: "Multi-storey stone heritage village with ancient murals",
    taglineAr: "قرية تراثية حجرية متعددة الطوابق بجداريات قديمة",
    region: "southern",
    imageUrl: "https://therestlessbeans.com/wp-content/uploads/2023/07/Rijal-Almaa-Saudi-Arabia-Asir-Building-Layers-The-Restless-Beans-M.webp",
    alt: "Layered multi-storey stone tower houses of Rijal Almaa heritage village in the Aseer region",
    fallback: "#1A1208",
  },
  {
    id: "al-habala",
    nameEn: "Al-Habala",
    nameAr: "الحبلة",
    taglineEn: "The ancient hanging village on sheer cliff faces",
    taglineAr: "القرية المعلقة القديمة على وجوه الجروف الشاهقة",
    region: "southern",
    imageUrl: "https://c.regencyholidays.com/blog/2023/11/161728_Rijal%20Almaa%20-%20Hero%20Image.webp",
    alt: "Ancient cliff-dwelling village perched dramatically on sheer rock faces in Aseer, Saudi Arabia",
    fallback: "#0D1520",
  },
  {
    id: "green-mountain",
    nameEn: "Green Mountain",
    nameAr: "الجبل الأخضر",
    taglineEn: "Abha's lush hilltop park with panoramic valley views",
    taglineAr: "حديقة أبها الخضراء مع مشاهد بانورامية للوادي",
    region: "southern",
    imageUrl: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&q=80&auto=format&fit=crop",
    alt: "Lush green mountain valley with terraced gardens and sweeping panoramic views",
    fallback: "#0A1A0E",
  },
  {
    id: "aseer-park",
    nameEn: "Aseer National Park",
    nameAr: "منتزه عسير الوطني",
    taglineEn: "Tanoumah forests and Muhayil's canyon trails",
    taglineAr: "غابات تنومة ومسارات وادي محايل",
    region: "southern",
    imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80&auto=format&fit=crop",
    alt: "Dense green forest canopy with mist rolling through the highland valleys of Aseer National Park",
    fallback: "#081208",
  },
  {
    id: "farasan",
    nameEn: "Farasan Islands",
    nameAr: "جزر فرسان",
    taglineEn: "Coral reefs, Ottoman fort, and Al Qassar village",
    taglineAr: "شعاب مرجانية وقلعة عثمانية وقرية القصار",
    region: "southern",
    imageUrl: "https://houseofsaud.com/wp-content/uploads/2026/04/farasan-islands-red-sea-coast.jpg",
    alt: "Turquoise waters and coral shoreline of the Farasan Islands in the southern Red Sea, Saudi Arabia",
    fallback: "#031822",
  },
  {
    id: "jazan",
    nameEn: "Jazan & Fifa Mountains",
    nameAr: "جازان وجبال فيفاء",
    taglineEn: "Tropical lowlands meet terraced mountain villages",
    taglineAr: "سهول استوائية تلتقي بقرى جبلية مدرجة",
    region: "southern",
    imageUrl: "https://thesauditimes.net/en/wp-content/uploads/2026/04/Fifa-Mountains-in-Jazan-A-Breathtaking-Natural-Destination-in-Saudi-Arabia.jpg",
    alt: "Lush terraced mountain slopes of the Fifa Mountains in Jazan region, Saudi Arabia",
    fallback: "#0A1A0E",
  },
  {
    id: "najran",
    nameEn: "Najran",
    nameAr: "نجران",
    taglineEn: "Al-Ukhdood antiquity site and mud-brick palaces",
    taglineAr: "موقع الأخدود الأثري وقصور الطين التاريخية",
    region: "southern",
    imageUrl: "https://media.assettype.com/outlooktraveller/2025-05-30/bl0fh8j4/AncientpetroglyphsatHimaCulturalAreanearNajranSaudiArabia10.jpg?w=600&auto=format,compress&fit=max",
    alt: "Ancient petroglyphs carved into rock at Hima Cultural Area near Najran, Saudi Arabia",
    fallback: "#1A1208",
  },
  {
    id: "al-baha",
    nameEn: "Al-Baha",
    nameAr: "الباحة",
    taglineEn: "Raghadan Forest and Thee Ain marble heritage village",
    taglineAr: "غابة رغدان وقرية ذي عين التراثية الرخامية",
    region: "southern",
    imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=80&auto=format&fit=crop",
    alt: "Sunlight filtering through a lush dense forest canopy in the Al-Baha highlands of Saudi Arabia",
    fallback: "#0A1208",
  },

  /* ── Eastern ── */
  {
    id: "ahsa",
    nameEn: "Al-Ahsa Oasis",
    nameAr: "واحة الأحساء",
    taglineEn: "UNESCO — world's largest natural date-palm oasis",
    taglineAr: "تراث يونسكو — أكبر واحة نخيل طبيعية في العالم",
    region: "eastern",
    imageUrl: "https://images.unsplash.com/photo-1584551230729-3a0de8cf4b00?w=600&q=80&auto=format&fit=crop",
    alt: "Rows of towering date palm trees at golden hour in the vast Al-Ahsa Oasis, Eastern Saudi Arabia",
    fallback: "#0C1608",
  },
  {
    id: "dammam",
    nameEn: "Dammam & Al Khobar",
    nameAr: "الدمام والخبر",
    taglineEn: "Gulf Corniche, seafood, and the Eastern Province pulse",
    taglineAr: "كورنيش الخليج والمأكولات البحرية ونبض المنطقة الشرقية",
    region: "eastern",
    imageUrl: "https://images.unsplash.com/photo-1631818175080-1af37f4e48fc?w=600&q=80&auto=format&fit=crop",
    alt: "Illuminated modern city skyline of Dammam reflecting on the calm Arabian Gulf waters at night",
    fallback: "#0A0E16",
  },
  {
    id: "half-moon",
    nameEn: "Half Moon Bay",
    nameAr: "نصف القمر",
    taglineEn: "Crescent beach, calm Gulf waters, and weekend escapes",
    taglineAr: "شاطئ هلالي ومياه خليجية هادئة وإجازة نهاية الأسبوع",
    region: "eastern",
    imageUrl: "https://onlybyland.com/wp-content/uploads/2025/06/Aerial-view-of-the-crescent-shaped-Half-Moon-Bay-in-Saudi-Arabia-showing-its-pristine-beaches.jpeg",
    alt: "Aerial view of the crescent-shaped Half Moon Bay with pristine white beaches in Saudi Arabia",
    fallback: "#031A20",
  },
  {
    id: "tarout",
    nameEn: "Tarout Island",
    nameAr: "جزيرة تاروت",
    taglineEn: "One of the world's oldest continuously inhabited islands",
    taglineAr: "واحدة من أقدم الجزر المأهولة باستمرار في العالم",
    region: "eastern",
    imageUrl: "https://blog.wasalt.sa/en/wp-content/uploads/2024/10/Tarout-Castle-1-750x422.jpg",
    alt: "Tarout Castle, the historic fort on Tarout Island in the Eastern Province of Saudi Arabia",
    fallback: "#0A0E16",
  },

  /* ── Northern ── */
  {
    id: "umluj",
    nameEn: "Umluj",
    nameAr: "أملج",
    taglineEn: "The Maldives of Saudi — white sand and calm lagoons",
    taglineAr: "جزر المالديف السعودية — رمال بيضاء وبحيرات هادئة",
    region: "northern",
    imageUrl: "https://houseofsaud.com/wp-content/uploads/2026/04/upload-111.jpg",
    alt: "Turquoise lagoon and white sand islands at Umluj on the Saudi Red Sea coast",
    fallback: "#031A20",
  },
  {
    id: "neom",
    nameEn: "NEOM & Red Sea Project",
    nameAr: "نيوم ومشروع البحر الأحمر",
    taglineEn: "Saudi Arabia's bold new frontier on the Red Sea coast",
    taglineAr: "الحدود السعودية الجديدة الجريئة على ساحل البحر الأحمر",
    region: "northern",
    imageUrl: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=600&q=80&auto=format&fit=crop",
    alt: "Sweeping golden sand dunes at sunset along the Red Sea coast in northwestern Saudi Arabia",
    fallback: "#0A0C14",
  },
  {
    id: "tabuk",
    nameEn: "Tabuk & Wadi Al-Disah",
    nameAr: "تبوك ووادي الديسة",
    taglineEn: "Canyon trekking through towering sandstone columns",
    taglineAr: "مشي في الوادي بين أعمدة الحجر الرملي الشاهقة",
    region: "northern",
    imageUrl: "https://houseofsaud.com/wp-content/uploads/2026/04/wadi-disah-canyon-resized.jpg",
    alt: "Towering sandstone canyon walls of Wadi Al-Disah glowing orange in afternoon sun near Tabuk",
    fallback: "#1A1008",
  },
  {
    id: "hail",
    nameEn: "Hail",
    nameAr: "حائل",
    taglineEn: "Jubbah & Shuwaymis UNESCO prehistoric rock art",
    taglineAr: "جبة وشويمس — الفن الصخري ما قبل التاريخ لليونسكو",
    region: "northern",
    imageUrl: "https://houseofsaud.com/wp-content/uploads/2026/04/travel-rockart-1s.jpg",
    alt: "Ancient prehistoric petroglyphs carved into volcanic rock at Jubbah near Hail, Saudi Arabia",
    fallback: "#0D1520",
  },
  {
    id: "sakaka",
    nameEn: "Sakaka & Al-Jawf",
    nameAr: "سكاكا والجوف",
    taglineEn: "Domat Al-Jandal palm groves and ancient Nabataean ruins",
    taglineAr: "نخيل دومة الجندل وأطلال نبطية قديمة",
    region: "northern",
    imageUrl: "https://visaliv.s3.ap-south-1.amazonaws.com/Dumat-al-Jandal-Saudi-Arabia.jpg",
    alt: "Ancient stone ruins and palm groves of Domat Al-Jandal in the Al-Jawf region near Sakaka",
    fallback: "#1A0F06",
  },
  {
    id: "tayma",
    nameEn: "Tayma",
    nameAr: "تيماء",
    taglineEn: "Bronze Age oasis with Persian, Babylonian, and Arab layers",
    taglineAr: "واحة من العصر البرونزي بطبقات فارسية وبابلية وعربية",
    region: "northern",
    imageUrl: "https://www.ancient-origins.net/sites/default/files/styles/large/public/The-ruins-of-a-fortress.jpg?itok=ZJHJ0HT9",
    alt: "Ancient stone fortress ruins of Tayma, the historic Bronze Age oasis city in northwestern Saudi Arabia",
    fallback: "#18120A",
  },
];

/* ── Filter tabs ─────────────────────────────────────────────────── */
const TABS: { id: Region; labelEn: string; labelAr: string }[] = [
  { id: "all",      labelEn: "All",      labelAr: "الكل"   },
  { id: "central",  labelEn: "Central",  labelAr: "الوسطى" },
  { id: "western",  labelEn: "Western",  labelAr: "الغربية"},
  { id: "southern", labelEn: "Southern", labelAr: "الجنوبية"},
  { id: "eastern",  labelEn: "Eastern",  labelAr: "الشرقية"},
  { id: "northern", labelEn: "Northern", labelAr: "الشمالية"},
];

/* ── Card component ──────────────────────────────────────────────── */
function DestCard({
  dest,
  isAr,
  index,
}: {
  dest: Destination;
  isAr: boolean;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={
        prefersReduced
          ? { duration: 0 }
          : { duration: 0.35, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }
      }
      className="relative overflow-hidden bg-card border border-border shadow-sm cursor-default focus-within:ring-2 focus-within:ring-[var(--sf-indigo)]"
      style={{ borderRadius: "10px", aspectRatio: "4/3" }}
      whileHover={prefersReduced ? {} : { y: -5, transition: { duration: 0.2 } }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {/* Image */}
      <img
        src={dest.imageUrl}
        alt={dest.alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          transition: prefersReduced ? "none" : "transform 700ms ease-out",
          transform: hovered && !prefersReduced ? "scale(1.1)" : "scale(1)",
        }}
        onError={(e) => {
          const el = e.currentTarget as HTMLImageElement;
          el.style.display = "none";
          const parent = el.parentElement;
          if (parent) parent.style.background = dest.fallback;
        }}
      />

      {/* Always-visible gradient (bottom dark) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(10,14,22,0.88) 0%, rgba(10,14,22,0.2) 50%, transparent 100%)",
        }}
      />

      {/* Hover overlay */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: hovered ? 1 : 0,
          background:
            "linear-gradient(to top, rgba(10,14,22,0.95) 30%, rgba(10,14,22,0.4) 70%, rgba(0,216,164,0.08) 100%)",
        }}
      />

      {/* Region badge */}
      <div className="absolute top-3 start-3 z-10">
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{
            background: "rgba(92,108,255,0.18)",
            color: "var(--sf-indigo)",
            border: "1px solid rgba(92,108,255,0.32)",
            backdropFilter: "blur(4px)",
          }}
        >
          {isAr
            ? TABS.find((t) => t.id === dest.region)?.labelAr
            : TABS.find((t) => t.id === dest.region)?.labelEn}
        </span>
      </div>

      {/* Text content */}
      <div className="absolute bottom-0 start-0 end-0 z-10 p-4">
        {/* Name — always visible */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3
            className="font-bold text-white leading-tight"
            style={{ fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)" }}
          >
            {dest.nameEn}
          </h3>
          <span
            className="text-sm"
            style={{ color: "rgba(255,255,255,0.65)" }}
            dir="rtl"
            lang="ar"
          >
            {dest.nameAr}
          </span>
        </div>

        {/* Tagline — slides up on hover */}
        <div
          className="overflow-hidden"
          style={{
            maxHeight: hovered ? "60px" : "0px",
            opacity: hovered ? 1 : 0,
            transition: prefersReduced
              ? "none"
              : "max-height 300ms ease-out, opacity 250ms ease-out",
          }}
        >
          <p
            className="text-xs mt-1.5 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.72)" }}
          >
            {isAr ? dest.taglineAr : dest.taglineEn}
          </p>
        </div>
      </div>
    </motion.article>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export function DestinationGallery() {
  const { dir } = useTranslation();
  const isAr = dir === "rtl";
  const [activeRegion, setActiveRegion] = useState<Region>("all");
  const tabsId = useId();

  const filtered =
    activeRegion === "all"
      ? DESTINATIONS
      : DESTINATIONS.filter((d) => d.region === activeRegion);

  return (
    <section
      className="py-20 px-4"
      aria-labelledby="gallery-heading"
    >
      <div className="max-w-7xl mx-auto">
        {/* Heading */}
        <div className="mb-12 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            {isAr ? "استكشف المملكة" : "Explore the Kingdom"}
          </p>
          <h2
            id="gallery-heading"
            className="text-3xl md:text-4xl font-bold text-foreground tracking-tight"
          >
            {isAr ? "وجهات لكل روح مسافرة" : "Destinations for Every Traveller"}
          </h2>
        </div>

        {/* Filter tabs */}
        <LayoutGroup id={tabsId}>
          <div
            role="tablist"
            aria-label={isAr ? "تصفية حسب المنطقة" : "Filter by region"}
            className="flex items-center gap-1 overflow-x-auto pb-2 mb-10 scrollbar-hide"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeRegion === tab.id}
                onClick={() => setActiveRegion(tab.id)}
                className="relative flex-shrink-0 px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--sf-indigo)]"
                style={{
                  color:
                    activeRegion === tab.id
                      ? "var(--sf-accent)"
                      : "var(--sf-text-muted)",
                }}
              >
                {activeRegion === tab.id && (
                  <motion.span
                    layoutId="tab-indicator"
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "rgba(0,216,164,0.1)",
                      border: "1px solid rgba(0,216,164,0.3)",
                    }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative z-10">
                  {isAr ? tab.labelAr : tab.labelEn}
                </span>
              </button>
            ))}
          </div>
        </LayoutGroup>

        {/* Grid — desktop 3-col, tablet 2-col; mobile: snap-scroll carousel */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {filtered.map((dest, i) => (
              <DestCard key={dest.id} dest={dest} isAr={isAr} index={i} />
            ))}
          </AnimatePresence>
        </div>

        {/* Mobile horizontal snap-scroll */}
        <div
          className="sm:hidden flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
        >
          {filtered.map((dest, i) => (
            <div
              key={dest.id}
              className="flex-shrink-0 snap-center w-[78vw]"
              style={{ aspectRatio: "4/3" }}
            >
              <div className="w-full h-full">
                <DestCard dest={dest} isAr={isAr} index={i} />
              </div>
            </div>
          ))}
        </div>

        {/* Result count */}
        <p
          className="mt-6 text-center text-xs text-muted-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          {isAr
            ? `${filtered.length} وجهة`
            : `${filtered.length} destination${filtered.length !== 1 ? "s" : ""}`}
        </p>
      </div>
    </section>
  );
}
