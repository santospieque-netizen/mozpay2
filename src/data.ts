export type Category = {
  id: string;
  name: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  pdfUrl?: string;
  description: string;
  categoryId: string;
  rating: number;
  downloads?: number;
  createdAt?: string;
  language?: string;
  schoolClass?: string;
  subject?: string;
  year?: string;
  summary?: string;
  synopsis?: string;
  tags?: string[];
};

export const CATEGORIES: Category[] = [
  { id: 'estudantis', name: 'Livros estudantis' },
  { id: 'romance', name: 'Livros de romance' },
  { id: 'historia', name: 'Livros de história' },
  { id: 'motivacionais', name: 'Livros motivacionais' },
  { id: 'religiosos', name: 'Livros religiosos' },
];

export const SCHOOL_CLASSES = [
  '8ª Classe',
  '9ª Classe',
  '10ª Classe',
  '11ª Classe',
  '12ª Classe',
  'Universidade',
];

export const SCHOOL_SUBJECTS = [
  'Matemática',
  'Física',
  'Química',
  'Biologia',
  'Português',
  'História',
  'Geografia',
  'Outras',
];

export const MOCK_BOOKS: Book[] = [
  {
    id: '1',
    title: 'Biologia Básica',
    author: 'Maria Silva',
    coverUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=300&h=450',
    description: 'Um guia completo sobre biologia para estudantes do ensino médio. Aborda desde a célula até ecossistemas.',
    categoryId: 'estudantis',
    schoolClass: '10ª Classe',
    subject: 'Biologia',
    year: '2023',
    rating: 4.8,
  },
  {
    id: '2',
    title: 'O Tempo e o Vento',
    author: 'Érico Veríssimo',
    coverUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=300&h=450',
    description: 'Um clássico do romance brasileiro que conta a formação do Rio Grande do Sul através da história de várias gerações.',
    categoryId: 'romance',
    rating: 4.9,
  },
  {
    id: '3',
    title: 'História do Mundo em 50 Fatos',
    author: 'João Pedro',
    coverUrl: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&q=80&w=300&h=450',
    description: 'Para quem ama história, este livro resume os 50 eventos mais impactantes que moldaram a humanidade.',
    categoryId: 'historia',
    rating: 4.6,
  },
  {
    id: '4',
    title: 'O Poder da Ação',
    author: 'Paulo Vieira',
    coverUrl: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=300&h=450',
    description: 'Acorde para os objetivos que quer conquistar. Um livro motivacional focado em ação e resultados.',
    categoryId: 'motivacionais',
    rating: 4.7,
  },
  {
    id: '5',
    title: 'Fundamentos da Fé',
    author: 'Anônimo',
    coverUrl: 'https://images.unsplash.com/photo-1438032005730-c779502df39b?auto=format&fit=crop&q=80&w=300&h=450',
    description: 'Um estudo profundo sobre a fé e as tradições religiosas.',
    categoryId: 'religiosos',
    rating: 4.5,
  },
  {
    id: '6',
    title: 'Matemática Descomplicada',
    author: 'Professor X',
    coverUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=300&h=450',
    description: 'Aprenda matemática de forma simples e direta. Ideal para preparatório de exames.',
    categoryId: 'estudantis',
    schoolClass: '12ª Classe',
    subject: 'Matemática',
    year: '2024',
    rating: 4.4,
  },
  {
    id: '7',
    title: 'Amor nos Tempos do Cólera',
    author: 'Gabriel García Márquez',
    coverUrl: 'https://images.unsplash.com/photo-1518621736915-f346c4136622?auto=format&fit=crop&q=80&w=300&h=450',
    description: 'A história do amor duradouro e as complicações do tempo e da velhice.',
    categoryId: 'romance',
    rating: 4.8,
  }
];
