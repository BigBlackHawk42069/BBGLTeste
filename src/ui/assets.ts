export function cdnize(u: string): string {
  return u.replace(
    /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(?:refs\/heads\/)?([^/]+)\//,
    'https://cdn.jsdelivr.net/gh/$1/$2@$3/'
  );
}

const decode = (s: string) => atob(s);

export interface StickerDef {
  id: number;
  name: string;
  url: string;
}

export const CUSTOM_STICKERS: StickerDef[] = [
  { id: 1, name: 'Just Checking the Mirror', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vanN0LWNoay1taXJyci5wbmc=') },
  { id: 2, name: 'Up, Down, Repeat', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vdXAtZG4tcnB0LnBuZw==') },
  { id: 3, name: 'Flat Bench Therapy', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vZmx0LWJuY2gtdGhycHkucG5n') },
  { id: 4, name: 'Bring Home the Feed', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vYnJuZy1obS1mZWVkLnBuZw==') },
  { id: 5, name: 'Never Skip Leg Day', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vbnZyLXNrcC1sZWcucG5n') },
  { id: 6, name: 'Tire Rotation', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vdGlyZS1yb3RuLnBuZw==') },
  { id: 7, name: 'Back End Engagement', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vYmNrLWVuZC1lbmdtdC5wbmc=') },
  { id: 8, name: 'The Upside of Exercise', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vdXBzZC1leHJjc2UucG5n') },
  { id: 9, name: 'Shellshock Stretches', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vc2hsc2hrLXN0cmNoLnBuZw==') },
  { id: 10, name: 'Certified Cardio', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9HeW0vY3J0ZmQtY3JkaW8ucG5n') },
  { id: 11, name: 'Just One More Spin', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vanN0LW9uZS1zcG4ucG5n') },
  { id: 12, name: 'Bingo! I Think...', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vYmluZ28taS10aG5rLnBuZw==') },
  { id: 13, name: 'Lucky Shot', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vbGNreS1zaHQucG5n') },
  { id: 14, name: 'Holy Craps', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vaG9seS1jcnBzLnBuZw==') },
  { id: 15, name: 'Tilted in My Favor', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vdGx0ZC1teS1mdnIucG5n') },
  { id: 16, name: 'Choose Wisely', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vY2hzZS13c2x5LnBuZw==') },
  { id: 17, name: 'Hit Me', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vaGl0LW1lLnBuZw==') },
  { id: 18, name: "Dead Men's Hand", url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vZGVhZC1tZW5zLnBuZw==') },
  { id: 19, name: 'Trigger Warning', url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vdHJnci13cm5nLnBuZw==') },
  { id: 20, name: "Leslie's Sick Day", url: decode('aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0JpZ0JsYWNrSGF3azQyMDY5L2FzZGZhc2tpamRuZmF3ZWYvcmVmcy9oZWFkcy9tYWluL1NjcnB0SW1ncy9TdGlja2VyYm9vay9DYXNpbm8vbHNscy1zY2stZHkucG5n') }
];

CUSTOM_STICKERS.forEach(s => {
  s.url = cdnize(s.url);
});

export const PAGE_TITLES = [
  'Sweat Equity',
  'Casino Collection',
  'Frequent Felon Passport',
  'Memories of Misdemeanors',
  'Postcards from the Frontline'
];
