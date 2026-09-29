import LegalPage from '@/components/LegalPage';

export const metadata = {
  title: 'Privacy Policy',
  description: 'HyrKro aapka data kaise collect, use aur protect karta hai.',
  alternates: { canonical: '/privacy' },
};

const sections = [
  {
    h: 'Hum kaunsa data lete hain',
    p: [
      'Account data: naam, email, mobile number (optional), shehar, business naam aur password (encrypted form mein).',
      'Freelancer profile: headline, category, skills, bio, charges, portfolio files aur profile photo.',
      'Chat aur orders: HyrKro chat ke messages, files, offers, meetings, orders, milestones aur reviews.',
      'Payment: payment Razorpay ke through hota hai. Hum card / UPI details store nahi karte – sirf payment ID aur status rakhte hain.',
      'Technical: IP address, device / browser info aur basic logs, security aur fraud rokne ke liye.',
    ],
  },
  {
    h: 'Data ka use kyun karte hain',
    p: [
      'Account chalane, clients aur freelancers ko milane, chat aur safe payment (escrow) chalane ke liye.',
      'Freelancer verification, fraud rokne aur platform ko surakshit rakhne ke liye.',
      'Zaroori updates bhejne ke liye (order, payment, security). Marketing messages sirf aapki marzi se.',
    ],
  },
  {
    h: 'Chat ki safety',
    p: [
      'Sirf HyrKro ki chat aur payment valid hai; bahar ki deal ke liye HyrKro zimmedar nahi. Isliye chat mein share kiye gaye phone number, email aur WhatsApp links apne aap chhupa diye jaate hain.',
      'Dispute ya shikayat ki jaanch ke liye HyrKro team zarurat padne par us order se judi chat dekh sakti hai.',
    ],
  },
  {
    h: 'Data kiske saath share hota hai',
    p: [
      'Hum aapka data bechte nahi hain.',
      'Service providers: MongoDB (database), Cloudinary (files), Razorpay (payments) – sirf service dene ke liye.',
      'Freelancer ki public profile (naam, photo, shehar, skills, charges, portfolio, reviews) sabko dikhti hai. Email aur phone kabhi public nahi hote.',
      'Kanoon ke mutabik sarkari authority maange to.',
    ],
  },
  {
    h: 'Data kitne time tak rakhte hain',
    p: [
      'Account active rehne tak. Account delete karne par 30 din mein data hata diya jaata hai, siwaay us data ke jo tax / legal kaaranon se rakhna zaroori ho (jaise payment records).',
    ],
  },
  {
    h: 'Aapke adhikaar',
    p: [
      'Digital Personal Data Protection Act, 2023 ke tahat aap apna data dekh, sudhaar aur delete karwa sakte ho, aur consent wapas le sakte ho.',
      'Settings page se apni details badlo. Data copy ya account delete ke liye neeche diye email pe likho.',
    ],
  },
  {
    h: 'Security',
    p: [
      'Passwords bcrypt se encrypt hote hain, saara traffic HTTPS pe chalta hai, aur login ke liye secure JWT tokens use hote hain. Phir bhi koi system 100% surakshit nahi hota – apna password kisi se share mat karo.',
    ],
  },
  {
    h: 'Cookies aur local storage',
    p: ['Hum login bana rakhne ke liye browser storage mein ek token rakhte hain. Third-party ad cookies use nahi karte.'],
  },
  {
    h: 'Grievance Officer / Sampark',
    p: [
      'Privacy se judi shikayat ya sawaal ke liye: privacy@hyrkro.com. Hum 7 working days mein jawab denge.',
      'Is policy mein badlav hone par is page ki "Last updated" date badal di jayegi.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="October 2026"
      intro="Aapka bharosa hamare liye sabse zaroori hai. Ye page seedhi bhasha mein batata hai ki HyrKro kaunsa data leta hai, kyun leta hai, aur aapke kya adhikaar hain."
      sections={sections}
    />
  );
}
