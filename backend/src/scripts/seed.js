/* Seed sample data for local testing: `npm run seed`
 * Creates: 1 admin, 2 clients, 12 verified and 4 unverified freelancers, 3 open requirements.
 * Login is by OTP — in demo mode the code is returned by the API, so any of
 * these phone numbers works with no SMS account.
 * Safe to re-run (skips existing phones). Do NOT run against production data.
 */
import { assertEnv, env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import FreelancerProfile from '../models/FreelancerProfile.js';
import Requirement from '../models/Requirement.js';
import { CITY_REGION } from '../config/constants.js';
import { addDays } from '../utils/helpers.js';

assertEnv();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Test@1234';

const FREELANCERS = [
  ['Aman Verma', '9000000001', 'noida', 'Sector 62', 'web-app-development', 'MERN stack developer – websites & web apps', ['React', 'Node.js', 'MongoDB', 'Next.js'], 800, 'hour', 4],
  ['Priya Sharma', '9000000002', 'noida', 'Sector 18', 'graphic-design', 'Logo, branding aur social media creatives', ['Logo Design', 'Canva', 'Illustrator', 'Branding'], 1500, 'project', 3],
  ['Rohit Singh', '9000000003', 'noida', 'Sector 137', 'digital-marketing', 'Google Ads & Meta Ads expert for local business', ['Google Ads', 'Meta Ads', 'SEO', 'Analytics'], 12000, 'project', 5],
  ['Sneha Gupta', '9000000004', 'greater-noida', 'Pari Chowk', 'content-writing', 'SEO blogs aur website content (Hinglish + English)', ['SEO Writing', 'Blogs', 'Copywriting'], 1500, 'project', 2],
  ['Karan Mehta', '9000000005', 'noida', 'Sector 50', 'video-photography', 'Reels, YouTube editing aur product shoots', ['Premiere Pro', 'Reels', 'Product Shoot'], 2500, 'project', 3],
  ['Ananya Iyer', '9000000006', 'delhi', 'Lajpat Nagar', 'influencers', 'Food & lifestyle creator – 45k Instagram', ['Instagram', 'Reels', 'Brand Collab'], 8000, 'project', 3],
  ['Vikas Gupta', '9000000007', 'noida', 'Sector 63', 'web-app-development', 'Backend / API developer (Node, Python)', ['Node.js', 'Python', 'REST API', 'AWS'], 900, 'hour', 6],
  ['Neha Kapoor', '9000000008', 'gurugram', 'DLF Phase 3', 'social-media', 'Social media manager for cafes & clinics', ['Instagram', 'Content Calendar', 'Canva'], 15000, 'project', 4],
  ['Arjun Yadav', '9000000009', 'ghaziabad', 'Indirapuram', 'virtual-assistant', 'Data entry, Excel aur admin support', ['Excel', 'Data Entry', 'Google Sheets'], 300, 'hour', 2],
  ['Simran Kaur', '9000000010', 'delhi', 'Rajouri Garden', 'graphic-design', 'UI/UX design – apps aur websites', ['Figma', 'UI Design', 'Wireframes'], 700, 'hour', 3],
  ['Mohit Jain', '9000000011', 'mumbai', 'Andheri', 'digital-marketing', 'Local SEO & Google Business Profile', ['Local SEO', 'GBP', 'Citations'], 6000, 'project', 3],
  ['Pooja Rawat', '9000000012', 'bengaluru', 'Koramangala', 'content-writing', 'Social media captions aur ad copy', ['Captions', 'Ad Copy', 'Hinglish'], 500, 'day', 1],
  ['Nisha Saini', '9000000013', 'noida', 'Sector 15', 'graphic-design', 'Social media creatives for growing brands', ['Canva', 'Instagram', 'Branding'], 1200, 'project', 2, 'pending'],
  ['Kabir Khan', '9000000014', 'delhi', 'Saket', 'web-app-development', 'Frontend developer for React websites', ['React', 'JavaScript', 'CSS'], 700, 'hour', 3, 'incomplete'],
  ['Tanya Das', '9000000015', 'gurugram', 'Sector 45', 'content-writing', 'Product descriptions and SEO articles', ['SEO', 'Copywriting', 'Research'], 900, 'project', 4, 'pending'],
  ['Dev Malhotra', '9000000016', 'jaipur', 'Malviya Nagar', 'video-photography', 'Short-form video editor for creators', ['Video Editing', 'Reels', 'Premiere Pro'], 1800, 'project', 2, 'incomplete'],
];

const REQUIREMENTS = [
  ['Cafe ke liye logo aur menu design', 'Noida Sector 18 mein naya cafe khol rahe hain. Logo, menu card aur 5 social media posts chahiye. Reference bhej sakte hain.', 'graphic-design', 'noida', 5000, 15000],
  ['Chhoti business website banwani hai', '5-6 page ki website chahiye – home, about, services, gallery, contact. Mobile pe achhi dikhni chahiye, aur Google pe aani chahiye.', 'web-app-development', 'noida', 20000, 50000],
  ['Instagram reels editor chahiye (monthly)', 'Har hafte 4 reels edit karni hongi. Raw footage hum denge. Long term kaam hai agar accha laga.', 'video-photography', 'delhi', 8000, 20000],
];

async function upsertUser(data) {
  let user = await User.findOne({ phone: data.phone });
  if (!user) user = await User.create(data);
  return user;
}

async function run() {
  await connectDB();

  const admin = await upsertUser({
    name: 'HyrKro Admin',
    phone: '9999900001',
    email: 'admin@hyrkro.test',
    password: ADMIN_PASSWORD,
    role: 'admin',
    phoneVerifiedAt: new Date(),
    acceptedPolicyAt: new Date(),
  });
  if (!admin.password) {
    admin.password = ADMIN_PASSWORD;
    await admin.save();
  }

  await upsertUser({
    name: 'Rahul Client',
    phone: '9999900002',
    email: 'client@hyrkro.test',
    role: 'client',
    roles: ['client'],
    city: 'noida',
    companyName: 'Rahul Traders',
    phoneVerifiedAt: new Date(),
    acceptedPolicyAt: new Date(),
  });
  const client2 = await upsertUser({
    name: 'Meera Shah',
    phone: '9999900003',
    role: 'client',
    roles: ['client'],
    city: 'noida',
    phoneVerifiedAt: new Date(),
    acceptedPolicyAt: new Date(),
  });

  for (let i = 0; i < FREELANCERS.length; i++) {
    const [name, phone, city, area, category, title, skills, amount, unit, exp, verificationStatus = 'verified'] = FREELANCERS[i];
    const user = await upsertUser({
      name,
      phone,
      role: 'freelancer',
      roles: ['freelancer'],
      city,
      phoneVerifiedAt: new Date(),
      acceptedPolicyAt: new Date(),
      kyc: { status: 'verified', legalName: name, panLast4: '1234', payout: { method: 'upi', upiId: `${name.split(' ')[0].toLowerCase()}@upi` }, reviewedAt: new Date() },
    });
    const rating = [4.9, 4.8, 4.7, 5, 4.6, 4.8][i % 6];
    await FreelancerProfile.updateOne(
      { user: user._id },
      {
        $set: {
          title,
          category,
          city,
          region: CITY_REGION[city] || '',
          area,
          skills,
          bio: `Namaste! Main ${name} hoon, ${area}, ${city} se. ${exp}+ saal ka experience. ${title}. Time pe kaam aur saaf baat – HyrKro chat pe message karo.`,
          experienceYears: exp,
          rate: { amount, unit },
          'verification.status': verificationStatus,
          ...(verificationStatus === 'verified' ? { 'verification.verifiedAt': new Date() } : {}),
          plan: { type: 'pro', proUntil: addDays(new Date(), env.proTrialDays), trialUsed: true },
          foundingFreelancer: true,
          ratingAvg: rating,
          ratingCount: 3 + (i % 7),
          completedOrders: 4 + i,
          isVisible: true,
          remoteOk: true,
        },
      },
      { upsert: true },
    );
  }

  for (const [title, description, category, city, budgetMin, budgetMax] of REQUIREMENTS) {
    const exists = await Requirement.findOne({ title, client: client2._id });
    if (!exists) {
      await Requirement.create({
        client: client2._id,
        title,
        description,
        category,
        city,
        budgetMin,
        budgetMax,
        status: 'open',
        expiresAt: addDays(new Date(), 30),
      });
    }
  }

  console.log('\nSeed complete.');
  console.log('Login is by OTP. In demo mode (no SMS keys) the API returns the code, so any number below works:');
  console.log('  9999900001  admin      (also: admin@hyrkro.test / ' + ADMIN_PASSWORD + ' at /admin/login)');
  console.log('  9999900002  client     (Rahul Traders)');
  console.log('  9999900003  client     (Meera Shah, has 3 open requirements)');
  console.log('  9000000001–9000000012  verified sample freelancers');
  console.log('  9000000013–9000000016  pending/incomplete sample freelancers\n');
  await disconnectDB();
}

run().catch(async (e) => {
  console.error(e);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
