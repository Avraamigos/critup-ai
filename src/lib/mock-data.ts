export const MOCK_USER = {
  name: 'Alex Kaya',
  email: 'alex.kaya@tu-berlin.de',
  initials: 'A',
  plan: 'Free' as const,
  discipline: 'Architecture',
  university: 'TU Berlin',
  year: '3',
  language: 'en',
};

export const MOCK_PROJECTS = [
  {
    id: 'riverside-pavilion',
    name: 'Riverside Cultural Pavilion',
    discipline: 'Architecture',
    date: 'May 1, 2026',
    stage: 'Finalized Design',
    stageColor: '#F97316',
    scores: { concept: 7.4, spatial: 8.1, presentation: 6.8 },
    daysAgo: '2 days ago',
  },
  {
    id: 'mixed-use-istanbul',
    name: 'Mixed-Use Block Istanbul',
    discipline: 'Urban Design',
    date: 'Apr 22, 2026',
    stage: 'Initial Concept',
    stageColor: 'oklch(0.72 0.17 145)',
    scores: { concept: 6.2, spatial: 7.0, presentation: 5.9 },
    daysAgo: '1 week ago',
  },
  {
    id: 'urban-plaza',
    name: 'Urban Plaza Redesign',
    discipline: 'Urban Design',
    date: 'Apr 10, 2026',
    stage: 'Jury Prep',
    stageColor: 'oklch(0.75 0.15 300)',
    scores: { concept: 8.5, spatial: 8.8, presentation: 9.1 },
    daysAgo: '2 weeks ago',
  },
  {
    id: 'atelier-apartment',
    name: 'Atelier Apartment Complex',
    discipline: 'Interior Architecture',
    date: 'Mar 28, 2026',
    stage: 'Pre-Design',
    stageColor: 'oklch(0.72 0.17 145)',
    scores: { concept: 5.8, spatial: 6.2, presentation: 5.5 },
    daysAgo: '5 weeks ago',
  },
  {
    id: 'harbor-promenade',
    name: 'Harbor Promenade',
    discipline: 'Landscape Architecture',
    date: 'Mar 12, 2026',
    stage: 'Finalized Design',
    stageColor: '#F97316',
    scores: { concept: 7.9, spatial: 8.3, presentation: 7.6 },
    daysAgo: '7 weeks ago',
  },
  {
    id: 'mountain-refuge',
    name: 'Mountain Research Refuge',
    discipline: 'Architecture',
    date: 'Feb 20, 2026',
    stage: 'Jury Prep',
    stageColor: 'oklch(0.75 0.15 300)',
    scores: { concept: 9.0, spatial: 8.7, presentation: 8.9 },
    daysAgo: '10 weeks ago',
  },
];

export const MOCK_ANALYSIS_PAGES = [
  {
    title: 'Concept Diagram',
    highlights: [
      { x: '30%', y: '35%', n: 1 },
      { x: '65%', y: '55%', n: 2 },
      { x: '50%', y: '75%', n: 3 },
    ],
    feedback: [
      { n: 1, title: 'Parti strength', text: 'The central void as organizer reads clearly.', suggestion: 'Develop the gradient between public and private more explicitly in plan.' },
      { n: 2, title: 'Program adjacency', text: 'Gallery-to-workshop relationship is intuitive.', suggestion: 'Consider showing this logic in a bubble diagram for jury clarity.' },
      { n: 3, title: 'Threshold logic', text: 'Entry sequence is underspecified.', suggestion: 'A 1:200 section through the entry would clarify this.' },
    ],
    scores: { concept: 7.4, spatial: 8.1, presentation: 6.8 },
  },
  {
    title: 'Ground Floor Plan',
    highlights: [
      { x: '40%', y: '40%', n: 1 },
      { x: '72%', y: '30%', n: 2 },
    ],
    feedback: [
      { n: 1, title: 'Circulation legibility', text: 'Main axis reads well. Secondary circulation is unclear near Grid B.', suggestion: 'Differentiate primary and secondary paths with line weight.' },
      { n: 2, title: 'Dead-end corridor', text: 'North-east corner creates a spatial dead end.', suggestion: 'Connect to service core or add a secondary exit.' },
    ],
    scores: { concept: 7.1, spatial: 7.8, presentation: 7.2 },
  },
  {
    title: 'Sectional Detail A',
    highlights: [
      { x: '35%', y: '45%', n: 1 },
      { x: '60%', y: '25%', n: 2 },
      { x: '55%', y: '65%', n: 3 },
    ],
    feedback: [
      { n: 1, title: 'Datum clarity', text: 'Ground level datum is missing. Jury will probe this immediately.', suggestion: 'Add ground datum line at 0.00m with a clear reference note.' },
      { n: 2, title: 'Ceiling height', text: '4.2m gallery height feels inconsistent with spatial narrative.', suggestion: 'Lower to 3.2m or explicitly justify the spatial release.' },
      { n: 3, title: 'Structure expression', text: 'Structural logic is not visible in section.', suggestion: 'Show column positions and structural depth.' },
    ],
    scores: { concept: 7.6, spatial: 7.3, presentation: 6.5 },
  },
];

export const JURY_QUESTIONS = [
  "Your sectional drawing doesn't show the ground datum level. How do you justify that decision?",
  "The 4.2m gallery ceiling height feels inconsistent with your 'compressed/released' spatial narrative. Can you explain this?",
  "Walk us through your circulation logic from the main entry to the gallery space.",
  "What precedent studies most influenced your structural approach?",
  "If you had two more weeks, what's the single change that would most improve this project?",
  "How does your project respond to the site's relationship with the river?",
  "The north-east corner appears to be a dead end. How does a user navigate through it?",
  "Explain your material palette choice and how it relates to the program.",
];

export const AI_REPLIES = [
  "Your weakest area is Presentation at 6.8. Main issues: inconsistent line weights and missing dimensions. Quick wins before jury day.",
  "For the datum issue: add a bold horizontal line at ±0.00m with a reference note. Standard convention — juries at Finalized Design stage expect it.",
  "Your concept is strong but undercommunicated. Try opening with: 'The project proposes a threshold gradient from public river edge to private workshop.' Say this in your first 30 seconds.",
  "The NE corner dead-end will come up. Prepare: it's a service-only zone accessed from the rear alley. 20 seconds, confident delivery.",
];
