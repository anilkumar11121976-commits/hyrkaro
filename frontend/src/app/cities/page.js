import CitiesView from './CitiesView';

export const metadata = {
  title: 'Shehar ke hisaab se freelancers',
  description: 'Noida, Delhi, Gurugram, Mumbai, Bengaluru aur aur bhi shehron mein verified freelancers dhoondo.',
  alternates: { canonical: '/cities' },
};

export default function CitiesPage() {
  return <CitiesView />;
}
