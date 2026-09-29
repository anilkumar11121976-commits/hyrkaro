import LegalPage from '@/components/LegalPage';

export const metadata = {
  title: 'Terms of Use',
  description: 'HyrKro use karne ke niyam – clients aur freelancers ke liye.',
  alternates: { canonical: '/terms' },
};

const sections = [
  {
    h: 'HyrKro kya hai',
    p: ['HyrKro ek online marketplace hai jahan businesses (clients) apne shehar ke freelancers dhoondh kar chat karte hain aur unhe hire karte hain. HyrKro khud kaam nahi karta; kaam freelancer karta hai.'],
  },
  {
    h: 'Account',
    p: [
      'Account banane ke liye aapki umar 18 saal ya usse zyada honi chahiye. Sahi jaankari do aur apna password surakshit rakho.',
      'Ek vyakti ka ek hi account. Fake profile, fake reviews ya kisi aur ke naam se account banana mana hai.',
    ],
  },
  {
    h: 'Pehle chat, phir hire',
    p: [
      'Client ko hire karne se pehle freelancer se HyrKro chat pe baat karni hoti hai. Rate aur kaam chat mein tay karo (offer / counter offer), phir chat se hi hire karo.',
      'Sirf HyrKro ki chat aur payment valid hai; bahar ki deal ke liye HyrKro zimmedar nahi. Platform ke bahar payment lene/dene par account band ho sakta hai.',
    ],
  },
  {
    h: 'Charges, fees aur commission',
    p: [
      'Freelancer apne charges khud tay karta hai. Client se HyrKro koi fee nahi leta (₹0).',
      'Freelancer ki kamai se HyrKro commission leta hai: Pro plan pe 5%, Free plan pe 10%. Naye freelancers ko pehla mahina Pro free milta hai.',
    ],
  },
  {
    h: 'Safe payment (escrow) aur milestones',
    p: [
      'Client ka payment HyrKro ke paas safe rehta hai. Kaam ek ya zyada milestones mein baanta ja sakta hai.',
      'Freelancer kaam submit karta hai; client approve kare to payment release hota hai aur commission katke 3 working days mein freelancer ke bank account mein bheja jaata hai.',
      'Client badlav maang sakta hai. Agar client bina wajah der kare ya dispute ho, to HyrKro team dono ki baat sun kar faisla karegi.',
    ],
  },
  {
    h: 'Refund aur cancel',
    p: [
      'Payment se pehle order kabhi bhi cancel ho sakta hai. Payment ke baad cancel/refund ke liye support se sampark karo – jo milestone approve nahi hua uska paisa, jaanch ke baad, wapas kiya ja sakta hai.',
    ],
  },
  {
    h: 'Mana hai',
    p: ['Gair-kanooni kaam, spam, gaali-galauj, kisi ka data ya kaam chori karna, fake reviews, aur HyrKro ke system ko nuksan pahunchana.'],
  },
  {
    h: 'Kaam ka ownership',
    p: ['Poora payment hone ke baad deliver kiya gaya kaam client ka hota hai, jab tak dono ne chat mein kuch aur tay na kiya ho. Freelancer apne portfolio mein kaam dikha sakta hai jab tak client mana na kare.'],
  },
  {
    h: 'Zimmedari ki seema',
    p: ['HyrKro freelancers ko verify karta hai, lekin kaam ki quality ki guarantee freelancer ki hai. Kanoon jitni ijazat de, HyrKro ki zimmedari us order ki HyrKro fee tak seemit hai.'],
  },
  {
    h: 'Sampark',
    p: ['Sawaal ya shikayat: support@hyrkro.com. Ye terms Bharat ke kanoon ke tahat hain.'],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated="October 2026"
      intro="HyrKro use karne se pehle ye niyam padh lo. Account banane ka matlab hai ki aap in niyamon se sehmat ho."
      sections={sections}
    />
  );
}
