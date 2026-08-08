const fs = require('fs');
const path = require('path');

const imgDir = '/Users/yhuakim/Desktop/my-projects/rimalis-main/rimalis-uis/apps/marketplace/public/images';

if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir, { recursive: true });
}

const svgs = {
  'cat_electronics.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#F3F4F6"/>
    <circle cx="150" cy="150" r="100" fill="#E5E7EB"/>
    <path d="M100,160 C100,100 200,100 200,160 M100,150 L100,190 C100,200 90,200 90,190 L90,160 C90,150 100,150 100,150 Z M200,150 L200,190 C200,200 210,200 210,190 L210,160 C210,150 200,150 200,150 Z" stroke="#111" stroke-width="12" fill="none" stroke-linecap="round"/>
    <rect x="80" y="150" width="30" height="45" rx="15" fill="#111"/>
    <rect x="190" y="150" width="30" height="45" rx="15" fill="#111"/>
  </svg>`,

  'cat_home.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#F0F7F4"/>
    <circle cx="150" cy="150" r="100" fill="#D8EBE4"/>
    <rect x="90" y="120" width="120" height="90" rx="20" fill="#2D6A4F"/>
    <rect x="75" y="140" width="30" height="70" rx="12" fill="#1B4332"/>
    <rect x="195" y="140" width="30" height="70" rx="12" fill="#1B4332"/>
    <rect x="105" y="195" width="20" height="35" rx="6" fill="#B7864B"/>
    <rect x="175" y="195" width="20" height="35" rx="6" fill="#B7864B"/>
  </svg>`,

  'cat_sports.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#F8FAFC"/>
    <circle cx="150" cy="150" r="100" fill="#E2E8F0"/>
    <path d="M80,180 Q110,130 170,140 Q220,140 230,180 L230,200 L80,200 Z" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="4"/>
    <path d="M80,200 L230,200 L230,215 L80,215 Z" fill="#1E293B"/>
    <path d="M120,165 Q140,150 170,165" stroke="#0EA5E9" stroke-width="6" stroke-linecap="round" fill="none"/>
  </svg>`,

  'cat_toys.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#FEFCE8"/>
    <circle cx="150" cy="150" r="100" fill="#FEF08A"/>
    <circle cx="150" cy="140" r="40" fill="#D97706"/>
    <circle cx="120" cy="110" r="15" fill="#B45309"/>
    <circle cx="180" cy="110" r="15" fill="#B45309"/>
    <circle cx="138" cy="135" r="5" fill="#111"/>
    <circle cx="162" cy="135" r="5" fill="#111"/>
    <ellipse cx="150" cy="148" rx="10" ry="7" fill="#78350F"/>
    <ellipse cx="150" cy="190" rx="45" ry="40" fill="#D97706"/>
  </svg>`,

  'cat_automotive.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#F4F4F5"/>
    <circle cx="150" cy="150" r="90" fill="#18181B"/>
    <circle cx="150" cy="150" r="60" fill="#71717A"/>
    <circle cx="150" cy="150" r="50" fill="#27272A"/>
    <circle cx="150" cy="150" r="20" fill="#A1A1AA"/>
    <line x1="150" y1="100" x2="150" y2="200" stroke="#E4E4E7" stroke-width="8"/>
    <line x1="100" y1="150" x2="200" y2="150" stroke="#E4E4E7" stroke-width="8"/>
    <line x1="115" y1="115" x2="185" y2="185" stroke="#E4E4E7" stroke-width="8"/>
    <line x1="115" y1="185" x2="185" y2="115" stroke="#E4E4E7" stroke-width="8"/>
  </svg>`,

  'cat_books.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#F0F4FE"/>
    <circle cx="150" cy="150" r="100" fill="#DBE5FE"/>
    <rect x="90" y="170" width="120" height="24" rx="4" fill="#1E40AF"/>
    <rect x="95" y="142" width="110" height="24" rx="4" fill="#0369A1"/>
    <rect x="85" y="114" width="130" height="24" rx="4" fill="#4338CA"/>
    <rect x="100" y="86" width="100" height="24" rx="4" fill="#0D9488"/>
  </svg>`,

  'prod_speaker.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#F8FAFC"/>
    <rect x="105" y="70" width="90" height="160" rx="45" fill="#1E293B"/>
    <circle cx="150" cy="120" r="25" fill="#334155" stroke="#475569" stroke-width="4"/>
    <circle cx="150" cy="180" r="30" fill="#334155" stroke="#475569" stroke-width="4"/>
    <circle cx="150" cy="180" r="12" fill="#0EA5E9"/>
  </svg>`,

  'prod_smartwatch.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#F8FAFC"/>
    <rect x="132" y="40" width="36" height="220" rx="8" fill="#18181B"/>
    <rect x="100" y="90" width="100" height="120" rx="28" fill="#09090B"/>
    <rect x="108" y="98" width="84" height="104" rx="20" fill="#18181B"/>
    <circle cx="150" cy="150" r="32" fill="none" stroke="#22C55E" stroke-width="6" stroke-dasharray="140 60"/>
    <text x="150" y="155" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" font-size="16">10:42</text>
  </svg>`,

  'prod_backpack.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#F8FAFC"/>
    <path d="M100,110 C100,70 200,70 200,110 L210,220 C210,235 195,245 180,245 L120,245 C105,245 90,235 90,220 Z" fill="#1E3A8A"/>
    <rect x="110" y="160" width="80" height="65" rx="12" fill="#1D4ED8"/>
    <path d="M125,75 C125,55 175,55 175,75" stroke="#1E3A8A" stroke-width="10" fill="none"/>
  </svg>`,

  'prod_earbuds.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#F8FAFC"/>
    <rect x="100" y="110" width="100" height="90" rx="30" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="4"/>
    <path d="M100,140 L200,140" stroke="#CBD5E1" stroke-width="2"/>
    <circle cx="150" cy="125" r="4" fill="#22C55E"/>
  </svg>`,

  'prod_waterbottle.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#F8FAFC"/>
    <rect x="135" y="60" width="30" height="25" rx="4" fill="#0F172A"/>
    <rect x="140" y="85" width="20" height="15" fill="#475569"/>
    <rect x="115" y="100" width="70" height="140" rx="20" fill="#1E3A8A"/>
  </svg>`,

  'prod_sunglasses.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#F8FAFC"/>
    <path d="M60,135 Q105,120 145,135 L155,135 Q195,120 240,135" stroke="#18181B" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M65,140 Q105,140 100,175 Q90,195 65,180 Q55,155 65,140 Z" fill="#18181B"/>
    <path d="M235,140 Q195,140 200,175 Q210,195 235,180 Q245,155 235,140 Z" fill="#18181B"/>
  </svg>`,

  'promo_summer_sale.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <rect width="400" height="300" fill="#E5EEF5"/>
    <circle cx="280" cy="180" r="90" fill="#0EA5E9" opacity="0.2"/>
    <path d="M230,160 C230,120 310,120 310,160 L320,230 L220,230 Z" fill="#0284C7"/>
    <ellipse cx="250" cy="110" rx="60" ry="20" fill="#F59E0B"/>
    <path d="M220,110 C220,80 280,80 280,110 Z" fill="#D97706"/>
  </svg>`,

  'promo_fresh_finds.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <rect width="400" height="300" fill="#F5EDE6"/>
    <circle cx="280" cy="180" r="90" fill="#F97316" opacity="0.15"/>
    <path d="M200,210 Q240,150 310,170 Q340,170 350,210 L350,230 L200,230 Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="4"/>
    <rect x="290" y="110" width="30" height="60" rx="15" fill="#A8A29E"/>
  </svg>`,

  'coll_fashion.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#F3ECE6"/>
    <path d="M120,80 L180,80 L210,240 L90,240 Z" fill="#D97706"/>
    <path d="M120,80 L150,130 L180,80" stroke="#FFF" stroke-width="6" fill="none"/>
  </svg>`,

  'coll_gaming.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#E6ECF2"/>
    <rect x="80" y="110" width="140" height="80" rx="35" fill="#18181B"/>
    <circle cx="115" cy="150" r="14" fill="#27272A"/>
    <circle cx="185" cy="140" r="6" fill="#EF4444"/>
    <circle cx="197" cy="152" r="6" fill="#3B82F6"/>
    <circle cx="173" cy="152" r="6" fill="#10B981"/>
    <circle cx="185" cy="164" r="6" fill="#F59E0B"/>
  </svg>`,

  'coll_living.png': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
    <rect width="300" height="300" fill="#ECEEEA"/>
    <path d="M130,130 L170,130 L190,190 L110,190 Z" fill="#F59E0B"/>
    <rect x="146" y="190" width="8" height="60" fill="#78350F"/>
    <ellipse cx="150" cy="250" rx="35" ry="10" fill="#78350F"/>
  </svg>`
};

Object.entries(svgs).forEach(([filename, svgContent]) => {
  const filePath = path.join(imgDir, filename);
  fs.writeFileSync(filePath, svgContent);
  console.log('Created ' + filename);
});
