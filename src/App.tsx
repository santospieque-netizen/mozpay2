import React, { useState, useEffect, useMemo } from 'react';
import { Book as BookIcon, Search, User, Menu, X, Download, Star, Heart, FileText, ChevronLeft, LogOut, Mail, Lock, Settings, ChevronRight, Home, Camera, Calendar, Clock, Shield, Upload, Trash2, Edit, Play, EyeOff, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_BOOKS, CATEGORIES, Book, SCHOOL_CLASSES, SCHOOL_SUBJECTS } from './data';
import { auth, db, googleProvider, storage } from './firebase';
import { supabase } from './supabase';
import BookCard from './components/BookCard';

const Logo = ({ className = "h-8" }: { className?: string }) => {

  return (
    <div className="flex items-center gap-2">
      <img 
        src="/logo.png" 
        alt="MozBooks" 
        className={`object-contain drop-shadow-2xl ${className}`}
      />
    </div>
  );
};

import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, collection, query, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import AdminPanel from './AdminPanel';

interface AppUser {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
  photoUrl?: string;
  createdAt?: string;
  stats?: {
    readingTimeMinutes?: number;
    totalDownloads?: number;
    readingGoal?: number;
  };
}

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'book' | 'profile' | 'favorites' | 'reading' | 'admin'>('home');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAuthor, setSearchAuthor] = useState('');
  const [searchLanguage, setSearchLanguage] = useState('');
  const [searchSchoolClass, setSearchSchoolClass] = useState('');
  const [searchSubject, setSearchSubject] = useState('');
  const [sortByPopular, setSortByPopular] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [readingHistory, setReadingHistory] = useState<{bookId: string, progress: number}[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [books, setBooks] = useState<Book[]>(MOCK_BOOKS); // Fallback to MOCK_BOOKS initially while loading
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);

  // Auth States
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password' | 'onboarding'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [selectedOnboardingGenres, setSelectedOnboardingGenres] = useState<string[]>([]);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<AppUser | null>(null);
  
  // Toast & Modals
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const resizeAndCompressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!loggedInUser || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsUploadingPhoto(true);
    try {
      const base64DataUrl = await resizeAndCompressImage(file);
      
      const userRef = doc(db, 'users', loggedInUser.id);
      await updateDoc(userRef, { photoUrl: base64DataUrl });
      
      try {
        if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL: base64DataUrl });
      } catch (err) {}
      
      setLoggedInUser(prev => prev ? { ...prev, photoUrl: base64DataUrl } : prev);
      showToast("Foto atualizada com sucesso!", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Erro ao processar e salvar a imagem.", "error");
    } finally {
      setIsUploadingPhoto(false);
    }
  };
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let timer: number;
    let accumulatedSeconds = 0;
    
    if (currentView === 'reading' && loggedInUser) {
      timer = window.setInterval(() => {
        accumulatedSeconds += 10; // Check every 10 seconds
        if (accumulatedSeconds >= 60) {
          accumulatedSeconds = 0;
          // Increment 1 minute in Firestore
          try {
            const userRef = doc(db, 'users', loggedInUser.id);
            updateDoc(userRef, {
              'stats.readingTimeMinutes': (loggedInUser.stats?.readingTimeMinutes || 0) + 1
            });
            // State update is handled by the users collection onSnapshot listener
          } catch(e) {
            console.error("Failed to update reading time", e);
          }
        }
      }, 10000); // 10s interval
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentView, loggedInUser]);

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInUser || !editName.trim()) return;
    setIsSubmitting(true);
    try {
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: editName });
      const userRef = doc(db, 'users', loggedInUser.id);
      await updateDoc(userRef, { name: editName });
      setLoggedInUser(prev => prev ? { ...prev, name: editName } : prev);
      setIsEditProfileOpen(false);
      showToast("Perfil atualizado com sucesso!", "success");
    } catch(err) {
      console.error(err);
      showToast("Erro ao atualizar o perfil.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!loggedInUser || !loggedInUser.email) return;
    setIsSubmitting(true);
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, loggedInUser.email);
      showToast("Email de redefinição enviado para " + loggedInUser.email, "success");
      setIsPasswordResetOpen(false);
    } catch (error) {
      console.error(error);
      showToast("Erro ao enviar email. Tente novamente.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustGoal = () => {
    const defaultGoal = loggedInUser?.stats?.readingGoal || 2;
    const goal = window.prompt("Defina sua meta mensal de leitura (livros):", defaultGoal.toString());
    if (goal && !isNaN(parseInt(goal)) && loggedInUser) {
       const userRef = doc(db, 'users', loggedInUser.id);
       updateDoc(userRef, { 'stats.readingGoal': parseInt(goal) })
         .then(() => showToast("Meta atualizada com sucesso!", "success"))
         .catch(e => { console.error(e); showToast("Erro ao atualizar meta.", "error"); });
    }
  };

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let isAdmin = false;
        if (user.email === 'domingosdossantospieque@gmail.com') {
          isAdmin = true;
        } else {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            isAdmin = adminDoc.exists();
          } catch(e) {
            console.error("Could not check admin status", e);
          }
        }

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        let userData = {
           createdAt: new Date().toISOString(),
           photoUrl: user.photoURL || '',
           stats: {
             readingTimeMinutes: 0,
             totalDownloads: 0
           }
        };

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            email: user.email || '',
            name: user.displayName || user.email?.split('@')[0] || 'Usuário',
            favorites: [],
            favoriteGenres: [],
            createdAt: userData.createdAt,
            photoUrl: userData.photoUrl,
            stats: userData.stats
          });
        } else {
          const data = userSnap.data();
          userData.createdAt = data.createdAt || userData.createdAt;
          userData.photoUrl = data.photoUrl || user.photoURL || '';
          userData.stats = data.stats || userData.stats;
        }

        setLoggedInUser({
          id: user.uid,
          name: userSnap.exists() ? userSnap.data().name : (user.displayName || user.email?.split('@')[0] || 'Usuário'),
          email: user.email || '',
          isAdmin: isAdmin,
          createdAt: userData.createdAt,
          photoUrl: userData.photoUrl,
          stats: userData.stats
        });
      } else {
        setLoggedInUser(null);
        setFavorites([]);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Monitor favorites when user is logged in
  useEffect(() => {
    if (!loggedInUser) return;
    
    const unsubscribeFav = onSnapshot(doc(db, 'users', loggedInUser.id), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.favorites) {
          setFavorites(data.favorites);
        }
        setLoggedInUser(prev => {
           if (!prev) return prev;
           return {
             ...prev,
             name: data.name || prev.name,
             photoUrl: data.photoUrl || prev.photoUrl,
             stats: data.stats || prev.stats
           };
        });
      }
    }, (error) => {
      if (error.code !== 'permission-denied') console.error('Snapshot error (users):', error);
    });

    const readingQuery = query(
      collection(db, 'reading_history'),
      where('userId', '==', loggedInUser.id)
    );
    const unsubscribeReading = onSnapshot(readingQuery, (snapshot) => {
      const history = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.userId === loggedInUser.id) {
          history.push({
            bookId: data.bookId,
            progress: data.progressPercentage || 0,
            lastReadAt: data.lastReadAt || ''
          });
        }
      });
      history.sort((a,b) => new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime());
      setReadingHistory(history);
    }, (error) => {
      if (error.code !== 'permission-denied') console.error('Snapshot error (reading_history):', error);
    });
    
    return () => {
      unsubscribeFav();
      unsubscribeReading();
    }
  }, [loggedInUser]);

  // Monitor books from both Supabase (primary) and Firestore (backup/sync)
  useEffect(() => {
    let firestoreUnsubscribe: (() => void) | undefined;
    let isMounted = true;

    const loadData = async () => {
      setIsLoadingBooks(true);
      
      try {
        // Try Supabase first
        console.log("Fetching from Supabase...");
        const { data: supabaseBooks, error: supabaseError } = await supabase
          .from('books')
          .select('*')
          .order('createdAt', { ascending: false });

        if (supabaseError) {
          console.warn("Supabase Fetch Error:", supabaseError.message);
        } else if (supabaseBooks && supabaseBooks.length > 0) {
          if (!isMounted) return;
          
          console.log(`Supabase returned ${supabaseBooks.length} books.`);
          const mappedBooks = supabaseBooks.map(b => ({
            ...b,
            id: String(b.id),
            title: b.title || '',
            author: b.author || '',
            description: b.description || '',
            coverUrl: b.coverUrl || b.cover_url || '',
            pdfUrl: b.pdfUrl || b.pdf_url || '',
            categoryId: b.categoryId || b.category_id || 'estudantis',
            schoolClass: b.schoolClass || b.school_class || '',
            subject: b.subject || '',
            year: b.year || '',
            rating: Number(b.rating || 5.0),
            createdAt: b.createdAt || b.created_at || new Date().toISOString()
          })) as Book[];
          
          setBooks(mappedBooks);
          setIsLoadingBooks(false);
          return; 
        }
      } catch (err) {
        console.warn("Supabase fetch exception", err);
      }

      // Fallback to Firestore
      if (!isMounted) return;
      console.log("Looking in Firestore...");

      const q = query(collection(db, 'books'), orderBy('createdAt', 'desc'));
      firestoreUnsubscribe = onSnapshot(q, (snapshot) => {
        if (!isMounted) return;

        if (!snapshot.empty) {
          const fetchedBooks: Book[] = [];
          snapshot.forEach((doc) => {
            fetchedBooks.push({ id: doc.id, ...doc.data() } as Book);
          });
          console.log(`Firestore returned ${fetchedBooks.length} books.`);
          setBooks(fetchedBooks);
        } else {
          console.log("Database is empty, keeping MOCK_BOOKS.");
          // We DON'T setBooks([]) here to keep the mocks visible if DB is empty
        }
        setIsLoadingBooks(false);
      }, (error) => {
        console.error("Firestore Error:", error);
        if (isMounted) setIsLoadingBooks(false);
      });
    };

    loadData();

    return () => {
      isMounted = false;
      if (firestoreUnsubscribe) firestoreUnsubscribe();
    };
  }, []);

  // Computed state
  const filteredBooks = useMemo(() => {
    return books.filter(book => {
      const matchesSearch = searchQuery === '' || 
                            book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            book.author.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAuthor = searchAuthor === '' || book.author.toLowerCase().includes(searchAuthor.toLowerCase());
      const matchesLanguage = searchLanguage === '' || (book.language && book.language.toLowerCase().includes(searchLanguage.toLowerCase()));
      const matchesSchoolClass = searchSchoolClass === '' || (book.schoolClass && book.schoolClass.toLowerCase().includes(searchSchoolClass.toLowerCase()));
      const matchesSubject = searchSubject === '' || (book.subject && book.subject.toLowerCase().includes(searchSubject.toLowerCase()));
      const matchesCategory = selectedCategory ? book.categoryId === selectedCategory : true;
      
      return matchesSearch && matchesAuthor && matchesLanguage && matchesSchoolClass && matchesSubject && matchesCategory;
    });
  }, [books, searchQuery, searchAuthor, searchLanguage, searchSchoolClass, searchSubject, selectedCategory]);

  const displayBooks = useMemo(() => {
    return sortByPopular 
      ? [...filteredBooks].sort((a, b) => (b.downloads ?? (b.rating * 10)) - (a.downloads ?? (a.rating * 10)))
      : filteredBooks;
  }, [filteredBooks, sortByPopular]);

  const [featuredIndex, setFeaturedIndex] = useState(0);

  useEffect(() => {
    if (displayBooks.length <= 1 || currentView !== 'home' || searchQuery || selectedCategory) return;
    
    const interval = setInterval(() => {
      setFeaturedIndex(prev => (prev + 1) % Math.min(displayBooks.length, 5));
    }, 5000);
    
    return () => clearInterval(interval);
  }, [displayBooks.length, currentView, searchQuery, selectedCategory]);

  const recommendedBooks = useMemo(() => {
    if (!loggedInUser || favorites.length === 0) return [];
    
    // Get categories or authors user likes from their favorites
    const favBooks = books.filter(b => favorites.includes(b.id));
    const favCategories = new Set(favBooks.map(b => b.categoryId));
    const favAuthors = new Set(favBooks.map(b => b.author));
    
    // Find books matching these but NOT in favorites
    const recommendations = books.filter(b => 
      !favorites.includes(b.id) && 
      (favCategories.has(b.categoryId) || favAuthors.has(b.author))
    );
    
    // Sort by rating internally
    return recommendations.sort((a,b) => (b.rating||0) - (a.rating||0)).slice(0, 10);
  }, [books, favorites, loggedInUser]);

  const newBooks = useMemo(() => {
    return [...books].sort((a,b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    }).slice(0, 10);
  }, [books]);

  const toggleFavorite = async (bookId: string) => {
    if (!loggedInUser) {
      setCurrentView('profile'); // Force login
      return;
    }
    
    const isFavorite = favorites.includes(bookId);
    // Optimistic UI update
    setFavorites(prev => 
      isFavorite ? prev.filter(id => id !== bookId) : [...prev, bookId]
    );
    
    try {
      const userRef = doc(db, 'users', loggedInUser.id);
      await updateDoc(userRef, {
        favorites: isFavorite ? arrayRemove(bookId) : arrayUnion(bookId)
      });
    } catch (error) {
      console.error("Error updating favorite:", error);
      // Revert optimistic update on failure
      setFavorites(prev => 
        !isFavorite ? prev.filter(id => id !== bookId) : [...prev, bookId]
      );
    }
  };

  const handleStartReading = async (bookOrEvent?: Book | React.MouseEvent) => {
    const isBook = bookOrEvent && !('nativeEvent' in bookOrEvent);
    const bookToRead = isBook ? (bookOrEvent as Book) : selectedBook;
    
    if (bookToRead) {
      setSelectedBook(bookToRead);
    }
    setCurrentView('reading');
    if (loggedInUser && bookToRead) {
      try {
        const historyId = `${loggedInUser.id}_${bookToRead.id}`;
        const historyRef = doc(db, 'reading_history', historyId);
        
        await setDoc(historyRef, {
          userId: loggedInUser.id,
          bookId: bookToRead.id,
          progressPercentage: 5, // Just simulating 5%
          lastReadAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error saving reading history: ", err);
      }
    }
  };

  const handleDownloadClick = async (book: Book) => {
    try {
      const dbBookRef = doc(db, 'books', book.id);
      const docSnap = await getDoc(dbBookRef);
      if (docSnap.exists()) {
        const currentDownloads = docSnap.data().downloads || 0;
        await updateDoc(dbBookRef, { downloads: currentDownloads + 1 });
      }
    } catch (e) {
      console.error("Failed to increment downloads:", e);
    }
  };

  const handleBookClick = (book: Book) => {
    setSelectedBook(book);
    setCurrentView('book');
    window.scrollTo(0, 0);
  };

  const handleToggleFavorite = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    toggleFavorite(bookId);
  };

  const renderBookRow = (title: string, data: Book[], icon?: React.ReactNode) => {
    if (!isLoadingBooks && data.length === 0) return null;
    
    return (
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xl font-serif font-bold italic text-gray-900 dark:text-white flex items-center gap-2">
            {icon}
            {title}
          </h2>
          {data.length > 5 && (
            <button className="text-[10px] uppercase tracking-widest text-[#d4af37] font-bold flex items-center hover:text-black dark:hover:text-white transition-colors">
              Ver todos <ChevronRight size={14} className="ml-1" />
            </button>
          )}
        </div>
        
        {isLoadingBooks && data.length === 0 ? (
          <div className="flex overflow-x-auto gap-4 sm:gap-5 pb-6 pt-2 px-1 scrollbar-hide snap-x">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex flex-col w-[125px] sm:w-[140px] md:w-[180px] flex-shrink-0 animate-pulse">
                <div className="aspect-[2/3] bg-gray-100 dark:bg-[#1a1a1a] rounded-lg mb-3"></div>
                <div className="h-3 bg-gray-100 dark:bg-[#1a1a1a] rounded w-3/4 mb-2"></div>
                <div className="h-2 bg-gray-100 dark:bg-[#1a1a1a] rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex overflow-x-auto gap-4 sm:gap-5 pb-6 pt-2 px-1 scrollbar-hide snap-x">
            {data.map(book => (
              <BookCard 
                key={book.id} 
                book={book} 
                className="w-[125px] sm:w-[140px] md:w-[180px]"
                isFavorite={favorites.includes(book.id)} 
                onBookClick={handleBookClick} 
                onToggleFavorite={handleToggleFavorite} 
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const clearAuthErrors = () => {
    setAuthError('');
    setAuthSuccess('');
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const getFirebaseErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case 'auth/invalid-email': return 'E-mail inválido.';
      case 'auth/user-disabled': return 'Este usuário foi desativado.';
      case 'auth/user-not-found': return 'Usuário não encontrado.';
      case 'auth/wrong-password': return 'Senha incorreta.';
      case 'auth/email-already-in-use': return 'Este e-mail já está em uso.';
      case 'auth/weak-password': return 'A senha é muito fraca (mínimo 6 caracteres).';
      case 'auth/invalid-credential': return 'Credenciais inválidas.';
      case 'auth/operation-not-allowed': return 'A autenticação por e-mail e senha não está ativada no Firebase Console.';
      default: return `Ocorreu um erro durante a autenticação. (${errorCode})`;
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthErrors();

    if (!email) {
      setAuthError('O campo de email é obrigatório.');
      return;
    }
    if (!validateEmail(email)) {
      setAuthError('Por favor, informe um email válido.');
      return;
    }

    if (authMode === 'forgot_password') {
      setIsSubmitting(true);
      try {
        await sendPasswordResetEmail(auth, email);
        setAuthSuccess(`Enviamos um link de recuperação para ${email}`);
        setEmail('');
      } catch (error: any) {
        setAuthError(getFirebaseErrorMessage(error.code));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setAuthError('A senha é obrigatória.');
      return;
    }

    if (authMode === 'register') {
      if (!name) {
        setAuthError('Por favor, informe seu nome.');
        return;
      }
      if (password.length < 6) {
        setAuthError('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setAuthError('As senhas não coincidem.');
        return;
      }
      
      setIsSubmitting(true);
      try {
        // Create in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Also replicate in Supabase Auth (simultaneously)
        const { error: supabaseError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name
            }
          }
        });
        
        if (supabaseError) {
          console.warn("Usuário criado no Firebase, mas falhou no Supabase:", supabaseError.message);
        }
        
        await updateProfile(user, { displayName: name });
        
        // Let onAuthStateChanged handle the rest, but locally force the view to onboarding
        setAuthMode('onboarding');
      } catch (error: any) {
        setAuthError(getFirebaseErrorMessage(error.code));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (authMode === 'login') {
      setIsSubmitting(true);
      try {
        await signInWithEmailAndPassword(auth, email, password);
        setCurrentView('home');
      } catch (error: any) {
        setAuthError(getFirebaseErrorMessage(error.code));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleGoogleLogin = async () => {
    clearAuthErrors();
    setIsSubmitting(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      
      const userRef = doc(db, 'users', res.user.uid);
      const userSnap = await getDoc(userRef);
      // Usually onAuthStateChange handles existence. We can check if genres are missing
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (!data.favoriteGenres || data.favoriteGenres.length === 0) {
           setAuthMode('onboarding');
           return;
        }
      } else {
        setAuthMode('onboarding');
        return;
      }

      setCurrentView('home');
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        setAuthError(getFirebaseErrorMessage(error.code));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishOnboarding = async () => {
     setIsSubmitting(true);
     try {
       if (loggedInUser) {
         const userRef = doc(db, 'users', loggedInUser.id);
         await updateDoc(userRef, {
           favoriteGenres: selectedOnboardingGenres
         });
       }
       setCurrentView('home');
       setAuthMode('login'); // Reset auth mode locally just in case
     } catch(e) {
       console.error("Failed saving genres", e);
       setAuthError("Erro ao salvar suas preferências.");
     } finally {
       setIsSubmitting(false);
     }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentView('home');
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-[#e5e5e5] font-sans selection:bg-[#d4af37]/30 selection:text-[#d4af37]">
      {/* Navigation */}
      {currentView !== 'reading' && (
        <nav className="sticky top-0 z-50 bg-white dark:bg-[#0a0a0a]/80 backdrop-blur-md border-b border-gray-200 dark:border-[#222]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setCurrentView('home'); setSelectedCategory(null); setSearchSchoolClass(''); setSearchSubject(''); }}>
              <Logo className="h-8 sm:h-10" />
            </div>

            {/* Desktop Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-[#444]" />
                </div>
                <input
                  type="text"
                  placeholder="Pesquisar livros, autores..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-[#222] rounded-full leading-5 bg-gray-50 dark:bg-[#151515] placeholder-[#666] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all text-xs text-gray-900 dark:text-[#e5e5e5]"
                />
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              {loggedInUser?.isAdmin && (
                <button 
                  onClick={() => setCurrentView('admin')}
                  className="flex items-center gap-2 text-gray-500 dark:text-[#999] hover:text-[#d4af37] transition-colors font-bold text-[11px] uppercase tracking-widest mr-2"
                  title="Área Administrativa"
                >
                  <Shield size={18} />
                  <span className="hidden lg:inline">Admin</span>
                </button>
              )}
              {loggedInUser ? (
                <button 
                  onClick={() => setCurrentView('profile')}
                  className="flex items-center gap-3 bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] hover:border-[#d4af37] px-4 py-1.5 rounded-full transition-all group"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#d4af37] to-[#f4d03f] text-black flex items-center justify-center font-bold text-[10px]">
                    {loggedInUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left hidden lg:block">
                    <span className="block text-[10px] uppercase text-gray-900 dark:text-[#e5e5e5] font-bold group-hover:text-[#d4af37] transition-colors">{loggedInUser.name}</span>
                  </div>
                </button>
              ) : (
                <button 
                  onClick={() => setCurrentView('profile')}
                  className="flex items-center gap-2 text-gray-500 dark:text-[#999] hover:text-black dark:hover:text-white transition-colors font-bold text-[11px] uppercase tracking-widest"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] text-[#d4af37] flex items-center justify-center">
                    <User size={16} />
                  </div>
                  Entrar
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-gray-500 dark:text-[#999] hover:text-black dark:hover:text-white focus:outline-none"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-[#111] border-b border-gray-200 dark:border-[#222] px-4 pt-4 pb-6 space-y-6 shadow-lg">
            <div className="flex justify-center mb-6 border-b border-gray-200 dark:border-[#222] pb-6">
              <Logo className="h-12" />
            </div>
            
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-[#444]" />
              </div>
              <input
                type="text"
                placeholder="Pesquisar livros..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-[#222] rounded-lg leading-5 bg-gray-50 dark:bg-[#151515] placeholder-[#666] text-gray-900 dark:text-[#e5e5e5] focus:outline-none focus:border-[#d4af37]"
              />
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => { setCurrentView('profile'); setIsMobileMenuOpen(false); }}
                className="flex items-center gap-3 text-gray-900 dark:text-[#e5e5e5] font-medium py-2"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] text-[#d4af37] flex items-center justify-center">
                  <User size={16} />
                </div>
                Entrar no perfil
              </button>
            </div>
          </div>
        )}
      </nav>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <AnimatePresence mode="wait">
        {currentView === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-6 md:gap-12 pb-20 md:pb-0"
          >
            
            {/* Welcome / Hero Area */}
            {displayBooks.length > 0 && !searchQuery && !selectedCategory && (() => {
              const carouselBooks = displayBooks.slice(0, Math.min(5, displayBooks.length || 1));
              const selectedBook = carouselBooks[featuredIndex] || carouselBooks[0];

              if (!selectedBook) return null;

              return (
                <div className="relative w-full h-[260px] sm:h-[340px] md:h-[480px] rounded-2xl overflow-hidden border border-gray-200 dark:border-[#222] shadow-2xl group bg-white dark:bg-[#0a0a0a]">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={`bg-${selectedBook.id}`}
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                      className="absolute inset-0"
                    >
                      <img 
                        src={selectedBook.coverUrl} 
                        alt={selectedBook.title}
                        className="absolute inset-0 w-full h-full object-cover dark:opacity-30 mix-blend-overlay opacity-20"
                      />
                    </motion.div>
                  </AnimatePresence>
                  
                  {/* Gradients */}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-100 via-gray-100/90 to-transparent dark:from-[#0a0a0a] dark:via-[#0a0a0a]/90 dark:to-transparent z-0 transition-colors duration-500"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-100/70 to-transparent dark:from-[#0a0a0a] dark:via-[#0a0a0a]/70 md:w-3/4 z-0 transition-colors duration-500"></div>

                  <div className="absolute inset-0 p-5 sm:p-8 md:p-14 pr-8 sm:pr-12 md:pr-16 z-10 w-full flex flex-row items-center justify-between h-full gap-4 md:gap-8">
                    <div className="flex-1 flex flex-col justify-center h-full w-full max-w-2xl relative z-20 pt-2 md:pt-0">
                      <AnimatePresence mode="popLayout">
                        <motion.div
                          key={`content-${selectedBook.id}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                        >
                          <div className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-[#d4af37] mb-1 md:mb-4 font-bold flex items-center gap-2">
                            <span className="w-4 md:w-8 h-[2px] bg-[#d4af37]"></span>
                            Seleção Premium
                          </div>
                          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold italic text-gray-900 dark:text-white mb-1.5 md:mb-4 leading-tight drop-shadow-md line-clamp-2 md:line-clamp-none">{selectedBook.title}</h1>
                          <p className="text-gray-700 dark:text-[#ccc] text-[10px] sm:text-sm md:text-base line-clamp-2 md:line-clamp-3 mb-4 md:mb-8 font-light drop-shadow-sm max-w-xl">{selectedBook.description}</p>
                          
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                            <button 
                              onClick={() => handleBookClick(selectedBook)}
                              className="bg-[#d4af37] hover:bg-[#f4d03f] text-black px-4 py-2 md:px-8 md:py-4 rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 md:gap-3 transition-transform hover:scale-105 shadow-[0_4px_20px_rgba(212,175,55,0.4)]"
                            >
                              <BookIcon size={14} className="hidden sm:inline-block" /> Ler
                            </button>
                            <button 
                              onClick={() => toggleFavorite(selectedBook.id)}
                              className={`backdrop-blur-md border px-3 py-2 md:px-5 md:py-4 rounded-full flex items-center justify-center transition-all hover:scale-105 ${
                                favorites.includes(selectedBook.id) 
                                  ? "bg-[#d4af37] border-[#d4af37] text-white" 
                                  : "bg-white/50 border-gray-300 text-gray-900 dark:bg-white/10 dark:border-white/20 dark:text-white hover:bg-white/80 dark:hover:bg-white/20"
                              }`}
                            >
                              <Heart size={14} className={`sm:w-[18px] sm:h-[18px] ${favorites.includes(selectedBook.id) ? "fill-white" : ""}`} />
                            </button>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    
                    {/* Cover Preview (Premium 3D effect - Visible on Mobile & Desktop) */}
                    <div className="w-20 sm:w-28 md:w-48 lg:w-56 flex-shrink-0 relative z-30 flex items-center justify-center pointer-events-none" style={{ perspective: "1000px" }}>
                      <AnimatePresence mode="popLayout">
                        <motion.img 
                          key={`cover-${selectedBook.id}`}
                          initial={{ opacity: 0, x: 30, rotateY: -15, scale: 0.9 }}
                          animate={{ opacity: 1, x: 0, rotateY: -5, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9, x: -30 }}
                          transition={{ duration: 0.6, delay: 0.1, type: "spring", stiffness: 100 }}
                          whileHover={{ rotateY: 0, scale: 1.05, transition: { duration: 0.3 } }}
                          src={selectedBook.coverUrl} 
                          alt="Cover" 
                          className="w-full h-auto max-h-[80%] object-contain drop-shadow-[5px_15px_15px_rgba(0,0,0,0.5)] dark:drop-shadow-[5px_20px_20px_rgba(0,0,0,0.7)] pointer-events-auto cursor-pointer" 
                          onClick={() => handleBookClick(selectedBook)}
                        />
                      </AnimatePresence>
                    </div>
                  </div>
                  
                  {/* Slider Controls */}
                  <div className="absolute right-1.5 md:right-6 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 md:gap-3 z-40">
                    {carouselBooks.map((_, idx) => (
                      <button
                        key={`nav-${idx}`}
                        onClick={() => setFeaturedIndex(idx)}
                        className={`w-1 transition-all duration-300 rounded-full md:w-1.5 ${idx === featuredIndex ? 'h-6 md:h-10 bg-[#d4af37]' : 'h-2 md:h-3 bg-gray-400 dark:bg-[#444] hover:bg-gray-600 dark:hover:bg-[#666]'}`}
                        aria-label={`Ir para a imagem ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Horizontal Categories Filter */}
            <div className="overflow-x-auto pb-4 scrollbar-hide">
              <div className="flex items-center gap-3 w-max px-1">
                <button
                  onClick={() => { setSelectedCategory(null); setSearchSchoolClass(''); setSearchSubject(''); }}
                  className={`px-5 py-2 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all ${
                    selectedCategory === null
                      ? 'bg-[#e5e5e5] text-black' 
                      : 'bg-transparent text-gray-500 dark:text-[#999] border border-gray-200 dark:border-[#222] hover:text-black dark:hover:text-white hover:border-[#444]'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setCurrentView('favorites')}
                  className="px-5 py-2 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all bg-transparent text-gray-500 dark:text-[#999] border border-gray-200 dark:border-[#222] hover:text-black dark:hover:text-white hover:border-[#444] flex items-center gap-2"
                >
                  <Heart size={14} className="text-[#d4af37]"/> Favoritos
                </button>
                <div className="w-[1px] h-6 bg-[#222] mx-2"></div>
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => { setSelectedCategory(category.id); setSearchSchoolClass(''); setSearchSubject(''); }}
                    className={`px-5 py-2 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all ${
                      selectedCategory === category.id 
                        ? 'bg-[#e5e5e5] text-black' 
                        : 'bg-transparent text-gray-500 dark:text-[#999] border border-gray-200 dark:border-[#222] hover:text-black dark:hover:text-white hover:border-[#444]'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Netflix-style Rows */}
            <div className="space-y-12">
              
              {/* If Searching, show as grid */}
              {(searchQuery || searchAuthor || searchLanguage) && (
                 <div>
                   <h2 className="text-xl font-serif font-bold italic text-gray-900 dark:text-white mb-6">Resultados da Busca</h2>
                   {displayBooks.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-gray-200 dark:border-[#222] rounded-2xl bg-white dark:bg-[#111]">
                        <Search size={28} className="mx-auto text-[#444] mb-4" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-[#e5e5e5]">Nenhum livro encontrado</h3>
                      </div>
                   ) : (
                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                       {displayBooks.map(book => (
                          <BookCard 
                            key={`search-${book.id}`} 
                            book={book} 
                            isFavorite={favorites.includes(book.id)} 
                            onBookClick={handleBookClick} 
                            onToggleFavorite={handleToggleFavorite} 
                          />
                        ))}
                     </div>
                   )}
                 </div>
              )}

              {/* Browse Rows (when not searching) */}
              {!searchQuery && !searchAuthor && !searchLanguage && (
                <>
                  {/* Continue Lendo (If history exists) */}
                  {!selectedCategory && loggedInUser && readingHistory.length > 0 && (
                     <div>
                      <div className="flex items-center justify-between mb-4 px-1">
                        <h2 className="text-xl font-serif font-bold italic text-gray-900 dark:text-white flex items-center gap-2"><BookIcon className="text-[#d4af37]" size={20}/> Continue Lendo</h2>
                      </div>
                      <div className="flex overflow-x-auto gap-4 pb-6 pt-2 px-1 scrollbar-hide snap-x">
                        {readingHistory.map(hist => {
                          const book = books.find(b => b.id === hist.bookId);
                          if (!book) return null;
                          return (
                            <div 
                              key={`continue-${book.id}`} 
                              className="group cursor-pointer flex flex-col w-[200px] sm:w-[220px] md:w-[240px] flex-shrink-0 snap-start bg-white dark:bg-[#111] p-3 rounded-xl border border-gray-200 dark:border-[#222] hover:border-[#d4af37] transition-all duration-300"
                              onClick={() => handleStartReading(book)}
                            >
                              <div className="relative flex gap-4 h-full bg-white dark:bg-[#111] p-3 rounded-xl border border-gray-200 dark:border-[#222] hover:border-[#555] hover:bg-gray-50 dark:bg-[#151515] transition-all duration-300">
                                <div className="w-16 sm:w-20 aspect-[2/3] rounded overflow-hidden flex-shrink-0 shadow-lg">
                                  <img src={book.coverUrl} alt={book.title} className="object-cover w-full h-full opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                                </div>
                                <div className="flex flex-col justify-center py-1 flex-1 min-w-0">
                                  <div>
                                    <h4 className="text-sm font-bold truncate text-gray-900 dark:text-[#e5e5e5] group-hover:text-black dark:hover:text-white transition-colors">{book.title}</h4>
                                    <p className="text-[10px] sm:text-xs text-[#888] truncate mt-0.5">{book.author}</p>
                                  </div>
                                  <div className="mt-4">
                                    <div className="flex justify-between items-center mb-1.5">
                                      <span className="text-[9px] text-gray-500 dark:text-[#999] uppercase tracking-wider font-bold">Progresso</span>
                                      <span className="text-[9px] text-[#d4af37] font-bold">{hist.progress}%</span>
                                    </div>
                                    <div className="w-full bg-[#222] h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-gradient-to-r from-[#d4af37] to-[#f4d03f] h-full rounded-full transition-all duration-500" style={{ width: `${hist.progress}%` }}></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Row 1: Mais Populares (Always shown) */}
                  {!selectedCategory && renderBookRow("Livros Mais Populares", [...displayBooks].sort((a,b) => (b.downloads||0) - (a.downloads||0)))}
                  
                  {/* Row: Novos Lançamentos */}
                  {!selectedCategory && renderBookRow("Novos Lançamentos", newBooks)}

                  {/* Row: Recomendados para Você */}
                  {!selectedCategory && recommendedBooks.length > 0 && renderBookRow("Recomendados para Você", recommendedBooks, <Star className="text-[#d4af37]" size={20}/>)}

                  {/* Dynamic Rows by Category */}
                  {CATEGORIES.filter(c => selectedCategory ? c.id === selectedCategory : true).map(category => {
                    const categoryBooks = displayBooks.filter(b => b.categoryId === category.id);
                    
                    if (category.id === 'estudantis' && selectedCategory === 'estudantis') {
                      return (
                        <div key="estudantis-ui" className="mt-4">
                          <h2 className="text-2xl font-serif font-bold italic text-gray-900 dark:text-white mb-6">Navegue por Classe</h2>
                          <div className="flex gap-3 mb-8 overflow-x-auto pb-4 scrollbar-hide snap-x">
                            <button
                              onClick={() => { setSearchSchoolClass(''); setSearchSubject(''); }}
                              className={`px-5 py-2 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap snap-start ${
                                searchSchoolClass === ''
                                  ? 'bg-[#d4af37] text-black' 
                                  : 'bg-gray-100 dark:bg-[#1a1a1a] text-gray-500 dark:text-[#999] border border-gray-300 dark:border-[#333] hover:text-black dark:hover:text-white hover:border-[#666]'
                              }`}
                            >
                              Todas as Classes
                            </button>
                            {SCHOOL_CLASSES.map(cls => (
                              <button
                                key={cls}
                                onClick={() => setSearchSchoolClass(cls)}
                                className={`px-5 py-2 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap snap-start ${
                                  searchSchoolClass === cls
                                    ? 'bg-[#d4af37] text-black' 
                                    : 'bg-gray-100 dark:bg-[#1a1a1a] text-gray-500 dark:text-[#999] border border-gray-300 dark:border-[#333] hover:text-black dark:hover:text-white hover:border-[#666]'
                                }`}
                              >
                                {cls}
                              </button>
                            ))}
                          </div>

                          {searchSchoolClass && (
                            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                              <button
                                onClick={() => setSearchSubject('')}
                                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                                  searchSubject === ''
                                    ? 'bg-[#e5e5e5] text-black' 
                                    : 'bg-transparent text-[#777] border border-gray-200 dark:border-[#222] hover:text-black dark:hover:text-white hover:border-[#444]'
                                }`}
                              >
                                Todas Disciplinas
                              </button>
                              {SCHOOL_SUBJECTS.map(subj => (
                                <button
                                  key={subj}
                                  onClick={() => setSearchSubject(subj)}
                                  className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                                    searchSubject === subj
                                      ? 'bg-[#e5e5e5] text-black' 
                                      : 'bg-transparent text-[#777] border border-gray-200 dark:border-[#222] hover:text-black dark:hover:text-white hover:border-[#444]'
                                  }`}
                                >
                                  {subj}
                                </button>
                              ))}
                            </div>
                          )}

                          {searchSchoolClass ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 mt-4">
                              {categoryBooks.filter(b => (!searchSubject || b.subject === searchSubject)).map(book => (
                                <BookCard 
                                  key={`estudante-${book.id}`} 
                                  book={book} 
                                  isFavorite={favorites.includes(book.id)}
                                  onBookClick={handleBookClick}
                                  onToggleFavorite={handleToggleFavorite}
                                />
                              ))}
                            </div>
                          ) : (
                            renderBookRow("Todos os Livros Estudantis", categoryBooks)
                          )}
                        </div>
                      );
                    }

                    return <React.Fragment key={category.id}>{renderBookRow(category.name, categoryBooks)}</React.Fragment>;
                  })}
                </>
              )}
            </div>

          </motion.div>
        )}

        {currentView === 'book' && selectedBook && (
          <motion.div 
            key="book"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-4xl mx-auto pt-4"
          >
            <button 
              onClick={() => setCurrentView('home')}
              className="flex items-center gap-2 text-[11px] font-bold text-gray-500 dark:text-[#999] uppercase tracking-widest hover:text-black dark:hover:text-white mb-8 transition-colors"
            >
              <ChevronLeft size={16} />
              Voltar ao catálogo
            </button>
            
            <div className="flex flex-col md:flex-row gap-8 lg:gap-12 bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl p-6 sm:p-8 relative overflow-hidden mb-20 md:mb-0">
              <div className="w-2/3 max-w-[240px] mx-auto md:max-w-none md:w-1/3 flex-shrink-0 z-10">
                <div className="aspect-[3/4] rounded-lg overflow-hidden shadow-2xl border border-gray-200 dark:border-[#222] bg-gray-100 dark:bg-[#1a1a1a]">
                  <img 
                    src={selectedBook.coverUrl} 
                    alt={selectedBook.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              
              <div className="flex-1 z-10 flex flex-col justify-center">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-[#d4af37] font-bold">
                    {CATEGORIES.find(c => c.id === selectedBook.categoryId)?.name}
                  </div>
                  {selectedBook.schoolClass && (
                    <div className="text-[10px] uppercase tracking-widest bg-gray-100 dark:bg-[#1a1a1a] text-[#888] px-2 py-0.5 rounded border border-gray-300 dark:border-[#333]">
                      {selectedBook.schoolClass}
                    </div>
                  )}
                  {selectedBook.subject && (
                    <div className="text-[10px] uppercase tracking-widest bg-gray-100 dark:bg-[#1a1a1a] text-[#888] px-2 py-0.5 rounded border border-gray-300 dark:border-[#333]">
                      {selectedBook.subject}
                    </div>
                  )}
                  {selectedBook.year && (
                    <div className="text-[10px] uppercase tracking-widest bg-gray-100 dark:bg-[#1a1a1a] text-[#888] px-2 py-0.5 rounded border border-gray-300 dark:border-[#333]">
                      Ano {selectedBook.year}
                    </div>
                  )}
                </div>
                <h1 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900 dark:text-white mb-4 italic">{selectedBook.title}</h1>
                <p className="text-sm text-gray-500 dark:text-[#999] mb-6">Escrito por <span className="text-gray-900 dark:text-[#e5e5e5] font-medium">{selectedBook.author}</span></p>
                
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#1a1a1a] text-[#d4af37] px-3 py-1.5 rounded border border-gray-300 dark:border-[#333] text-xs font-bold">
                    <Star size={14} className="fill-[#d4af37]" />
                    {selectedBook.rating} Avaliações
                  </div>
                  <div className="text-[#777] uppercase tracking-widest text-[10px] font-bold">Acesso Gratuito</div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mb-10">
                  <button 
                    onClick={handleStartReading}
                    className="flex-1 bg-[#d4af37] hover:bg-[#f4d03f] text-black px-6 py-3 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                  >
                    <FileText size={16} />
                    Ler Online (PDF)
                  </button>
                  {selectedBook.pdfUrl ? (
                    <a 
                      href={selectedBook.pdfUrl}
                      onClick={() => handleDownloadClick(selectedBook)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-transparent hover:bg-white text-gray-900 dark:text-[#e5e5e5] hover:text-black border border-[#444] px-6 py-3 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all text-center focus:outline-none"
                    >
                      <Download size={16} />
                      Download
                    </a>
                  ) : (
                    <button disabled className="bg-transparent opacity-50 text-gray-900 dark:text-[#e5e5e5] border border-[#444] px-6 py-3 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed">
                      <Download size={16} />
                      Indisponível
                    </button>
                  )}
                  <button 
                    onClick={() => toggleFavorite(selectedBook.id)}
                    className="bg-transparent hover:bg-white text-gray-900 dark:text-[#e5e5e5] hover:text-black border border-[#444] px-4 py-3 rounded flex items-center justify-center transition-all group"
                    title="Adicionar aos favoritos"
                  >
                    <Heart size={18} className={`${favorites.includes(selectedBook.id) ? "fill-[#d4af37] text-[#d4af37]" : ""} group-hover:text-black`} />
                  </button>
                </div>

                <div>
                  <h3 className="text-[11px] uppercase tracking-widest text-[#444] font-bold mb-3">Sinopse</h3>
                  <div className="text-gray-500 dark:text-[#999] text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedBook.synopsis || selectedBook.description}
                  </div>
                  
                  {selectedBook.tags && selectedBook.tags.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {selectedBook.tags.map((tag, idx) => (
                        <span key={idx} className="bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-[#bbb] border border-gray-200 dark:border-[#333] px-2 py-1 transform rounded text-[10px] uppercase font-bold tracking-widest">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Background accent */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4af37] opacity-5 blur-[120px] rounded-full pointer-events-none"></div>
            </div>
            
            {/* Future Ad Slot */}
            <div className="mt-8 bg-white dark:bg-[#111] rounded h-16 flex items-center justify-center border border-dashed border-gray-300 dark:border-[#333] text-center text-[9px] uppercase tracking-widest text-[#444]">
              Espaço Publicitário - Google AdSense
            </div>
          </motion.div>
        )}

        {currentView === 'favorites' && (
          <motion.div 
            key="favorites"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="max-w-7xl mx-auto pb-20 md:pb-0"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-serif font-bold italic text-gray-900 dark:text-[#e5e5e5]">Meus Favoritos</h1>
                <p className="text-[#777] mt-1 text-sm">Biblioteca pessoal com seus livros salvos.</p>
              </div>
              <div className="h-[1px] flex-1 bg-[#222] mx-4 hidden sm:block"></div>
            </div>

            {favorites.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-gray-200 dark:border-[#222] rounded-2xl bg-white dark:bg-[#111]">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] text-[#444] mb-6 shadow-Inner">
                  <Heart size={32} />
                </div>
                <h3 className="text-lg font-serif font-bold italic text-gray-900 dark:text-[#e5e5e5]">Nenhum livro favorito</h3>
                <p className="text-gray-400 dark:text-[#666] text-sm mt-2 mb-8 max-w-sm mx-auto">Você ainda não adicionou nenhum livro aos favoritos. Explore nosso catálogo e salve seus títulos preferidos.</p>
                <button 
                  onClick={() => setCurrentView('home')}
                  className="bg-[#d4af37] text-black px-8 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all hover:bg-[#f4d03f] hover:scale-105 shadow-lg shadow-[#d4af37]/20"
                >
                  Explorar Livros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {books.filter(book => favorites.includes(book.id)).map((book) => (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    isFavorite={true} 
                    onBookClick={handleBookClick} 
                    onToggleFavorite={handleToggleFavorite} 
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {currentView === 'reading' && selectedBook && (
          <motion.div 
            key="reading"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[100] bg-[#fdfaf6] dark:bg-white dark:bg-[#111] flex flex-col"
          >
            {/* Header / Nav of Reader */}
            <div className="h-14 bg-white/80 dark:bg-gray-50 dark:bg-[#151515]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-200 dark:border-[#222] flex items-center justify-between px-4 sm:px-6 z-10 transition-colors duration-300">
              <button 
                onClick={() => setCurrentView('book')}
                className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-500 dark:text-[#999] uppercase tracking-widest hover:text-black dark:hover:text-black dark:hover:text-white transition-colors"
              >
                <ChevronLeft size={16} />
                Voltar
              </button>
              
              <div className="text-center hidden sm:block">
                <h3 className="font-serif italic text-sm text-gray-800 dark:text-gray-900 dark:text-[#e5e5e5]">{selectedBook.title}</h3>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-[#666] uppercase tracking-widest">{selectedBook.author}</span>
              </div>
              
              <div className="flex items-center gap-4">
                 <button className="text-gray-500 hover:text-black dark:text-gray-500 dark:text-[#999] dark:hover:text-black dark:hover:text-white transition-colors">
                   <Settings size={18} />
                 </button>
                 <button className="text-gray-500 hover:text-black dark:text-gray-500 dark:text-[#999] dark:hover:text-black dark:hover:text-white transition-colors">
                   <Heart size={18} className={favorites.includes(selectedBook.id) ? "fill-[#d4af37] text-[#d4af37]" : ""} />
                 </button>
              </div>
            </div>

            <div className="flex-1 bg-[#fdfaf6] dark:bg-gray-100 dark:bg-[#1a1a1a] flex flex-col items-center overflow-hidden z-10 p-0 sm:p-4 md:p-8 relative">
              {selectedBook.pdfUrl ? (
                <div className="w-full h-full max-w-5xl bg-white dark:bg-[#222] shadow-2xl sm:rounded-lg overflow-hidden flex flex-col">
                   <iframe 
                    src={`${selectedBook.pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                    className="hidden md:block w-full h-full border-0 flex-1"
                    title={`PDF Reader Desktop para ${selectedBook.title}`}
                  />
                  <iframe 
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(selectedBook.pdfUrl)}&embedded=true`}
                    className="md:hidden w-full h-full border-0 flex-1"
                    title={`PDF Reader Mobile para ${selectedBook.title}`}
                  />
                </div>
              ) : (
                <div className="w-full h-full max-w-3xl bg-white dark:bg-gray-50 dark:bg-[#151515] shadow-2xl p-8 sm:p-12 md:p-16 min-h-[600px] text-gray-800 dark:text-[#ccc] overflow-y-auto rounded-lg">
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold italic mb-6 text-center text-black dark:text-gray-900 dark:text-white">{selectedBook.title}</h1>
                  <p className="text-sm font-medium mb-12 text-center text-gray-500 dark:text-[#888]">Por {selectedBook.author}</p>
                  
                  <div className="space-y-6 font-serif text-lg leading-loose">
                    <p>
                      <span className="text-7xl float-left mr-4 font-bold leading-none mt-[-10px] text-[#d4af37]">E</span>
                      ste é um arquivo de demonstração focado no design da plataforma MozBooks. No modo Leitura Premium, nós ajustamos a tipografia para maximizar o conforto visual, utilizando fontes serifadas elegantes e margens generosas.
                    </p>
                    <p>
                      Suspendisse potenti. In hac habitasse platea dictumst. Vivamus sit amet tellus a turpis placerat faucibus 
                      et id ex. Nullam at diam sem. Aliquam volutpat sed ex in ultrices. Phasellus et elit vel sapien rutrum tempor 
                      in vel magna. Duis eget sem sit amet nibh convallis hendrerit.
                    </p>
                    <p>
                      O arquivo PDF finalizado deve carregar diretamente sem bordas desnecessárias, ou o texto EPUB renderizado nativamente neste container, trazendo a verdadeira experiência do Kindle para a Web.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Progress Bar */}
            <div className="h-1 bg-gray-200 dark:bg-[#222] w-full absolute bottom-0 left-0 z-20">
               <div className="h-full bg-[#d4af37] w-[15%]"></div>
            </div>
          </motion.div>
        )}

        {currentView === 'profile' && (
          <motion.div 
            key="profile"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-5xl mx-auto relative mt-4 md:mt-8 pb-24 md:pb-8"
          >
            {loggedInUser ? (
              <>
              <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 px-4 sm:px-6 lg:px-8">
                {/* Sidebar / User Info Card */}
                <div className="w-full lg:w-1/3 xl:w-1/4 space-y-6">
                  <div className="bg-white dark:bg-[#111] rounded-2xl shadow-xl border border-gray-200 dark:border-[#222] p-8 text-center relative overflow-hidden group">
                     {/* Photo Upload */}
                     <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-6 cursor-pointer">
                       {loggedInUser.photoUrl ? (
                         <img src={loggedInUser.photoUrl} alt="Perfil" className="w-full h-full object-cover rounded-full shadow-[0_0_30px_rgba(212,175,55,0.15)] ring-2 ring-[#d4af37]/30 group-hover:ring-[#d4af37] transition-all" />
                       ) : (
                         <div className="w-full h-full bg-gradient-to-tr from-[#d4af37] to-[#f4d03f] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.15)] text-4xl font-bold font-serif text-black uppercase ring-2 ring-[#d4af37]/30 group-hover:ring-[#d4af37] transition-all">
                           {loggedInUser.name.charAt(0)}
                         </div>
                       )}
                       <label className="absolute inset-0 bg-black/60 rounded-full opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer backdrop-blur-sm z-10">
                         <Camera size={24} className="text-white mb-1" />
                         <span className="text-[10px] uppercase font-bold text-white tracking-widest">Alterar</span>
                         <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploadingPhoto} />
                       </label>
                       {isUploadingPhoto && (
                          <div className="absolute inset-0 bg-black/80 rounded-full flex items-center justify-center z-20">
                            <div className="w-6 h-6 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin"></div>
                          </div>
                       )}
                     </div>
                     <h2 className="text-2xl font-serif font-bold italic text-gray-900 dark:text-white mb-1">{loggedInUser.name}</h2>
                     <p className="text-xs text-[#777] mb-2">{loggedInUser.email}</p>
                     <p className="text-[10px] text-[#555] uppercase tracking-widest font-bold mb-0">
                       Membro desde {new Date(loggedInUser.createdAt || Date.now()).getFullYear()}
                     </p>
                  </div>
                  
                  {loggedInUser.isAdmin && (
                    <div 
                      onClick={() => setCurrentView('admin')}
                      className="bg-gradient-to-br from-[#1a1a1a] to-[#111] rounded-2xl shadow-xl border border-[#d4af37]/30 p-6 relative overflow-hidden group cursor-pointer hover:border-[#d4af37] transition-colors"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                        <Shield size={64} className="text-[#d4af37]" />
                      </div>
                      <h3 className="text-lg font-serif font-bold italic text-[#d4af37] mb-2 flex items-center gap-2">
                        <Shield size={18}/> Área Admin
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-[#999] mb-4 relative z-10">Acesse o painel para gerenciar o acervo da plataforma.</p>
                      <div className="text-[10px] uppercase tracking-widest font-bold text-[#d4af37] flex items-center gap-1 group-hover:gap-2 transition-all">
                        Ir para painel <ChevronRight size={12} />
                      </div>
                    </div>
                  )}

                  {/* Configurações básicas */}
                  <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl overflow-hidden mt-6 shadow-xl">
                    <button 
                      onClick={() => { setEditName(loggedInUser.name); setIsEditProfileOpen(true); }}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-100 dark:bg-[#1a1a1a] transition-colors border-b border-gray-200 dark:border-[#222]"
                    >
                      <div className="flex items-center gap-3 text-gray-900 dark:text-[#e5e5e5]">
                         <Edit size={16} className="text-gray-500 dark:text-[#999]" />
                         <span className="text-sm">Editar Perfil</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 dark:text-[#666]" />
                    </button>
                    <button 
                      onClick={() => setIsPasswordResetOpen(true)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-100 dark:bg-[#1a1a1a] transition-colors border-b border-gray-200 dark:border-[#222]"
                    >
                      <div className="flex items-center gap-3 text-gray-900 dark:text-[#e5e5e5]">
                         <Lock size={16} className="text-gray-500 dark:text-[#999]" />
                         <span className="text-sm">Alterar Senha</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 dark:text-[#666]" />
                    </button>
                    <button 
                      onClick={() => setIsPreferencesOpen(true)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-100 dark:bg-[#1a1a1a] transition-colors border-b border-gray-200 dark:border-[#222]"
                    >
                      <div className="flex items-center gap-3 text-gray-900 dark:text-[#e5e5e5]">
                         <Settings size={16} className="text-gray-500 dark:text-[#999]" />
                         <span className="text-sm">Preferências</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 dark:text-[#666]" />
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center justify-between p-4 hover:bg-red-500/10 transition-colors text-red-500"
                    >
                      <div className="flex items-center gap-3">
                         <LogOut size={16} />
                         <span className="text-sm font-medium">Sair da Conta</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="w-full lg:w-2/3 xl:w-3/4 space-y-6">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl p-5 relative overflow-hidden group shadow-xl">
                       <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                         <BookIcon size={80} className="text-gray-900 dark:text-white" />
                       </div>
                       <span className="block text-3xl font-serif italic text-gray-900 dark:text-white mb-1">
                          {readingHistory.filter(h => h.progress >= 95).length}
                       </span>
                       <span className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-[#999] font-bold">Livros Lidos</span>
                    </div>
                    <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl p-5 relative overflow-hidden group shadow-xl">
                       <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                         <Heart size={80} className="text-[#d4af37]" />
                       </div>
                       <span className="block text-3xl font-serif italic text-[#d4af37] mb-1">{favorites.length}</span>
                       <span className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-[#999] font-bold">Favoritos</span>
                    </div>
                    <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl p-5 relative overflow-hidden group shadow-xl">
                       <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                         <Download size={80} className="text-gray-900 dark:text-white" />
                       </div>
                       <span className="block text-3xl font-serif italic text-gray-900 dark:text-white mb-1">
                          {loggedInUser.stats?.totalDownloads || 0}
                       </span>
                       <span className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-[#999] font-bold">Downloads</span>
                    </div>
                    <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl p-5 relative overflow-hidden group shadow-xl">
                       <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                         <Clock size={80} className="text-gray-900 dark:text-white" />
                       </div>
                       <span className="block text-3xl font-serif italic text-gray-900 dark:text-white mb-1">
                          {loggedInUser.stats?.readingTimeMinutes ? Math.floor(loggedInUser.stats.readingTimeMinutes / 60) : 0}h
                       </span>
                       <span className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-[#999] font-bold">Leitura</span>
                    </div>
                  </div>

                  {/* Continue Reading */}
                  {readingHistory.filter(h => h.progress < 100).length > 0 && (
                    <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                       <h3 className="text-xl font-serif font-bold italic text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                         <BookIcon className="text-[#d4af37]" size={20} /> Continue Lendo
                       </h3>
                       <div className="flex overflow-x-auto gap-4 scrollbar-hide snap-x relative z-10">
                         {[...readingHistory]
                           .filter(h => h.progress < 100)
                           .sort((a, b) => new Date(b.lastReadAt || 0).getTime() - new Date(a.lastReadAt || 0).getTime())
                           .slice(0, 5)
                           .map(hist => {
                           const book = books.find(b => b.id === hist.bookId);
                           if (!book) return null;
                           return (
                             <div 
                               key={`profile-hist-${hist.bookId}`}
                               onClick={() => handleBookClick(book)}
                               className="w-[125px] sm:w-[140px] flex-shrink-0 cursor-pointer group snap-start"
                             >
                               <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-3 shadow-lg border border-gray-300 dark:border-[#333] group-hover:border-[#d4af37] transition-colors">
                                 <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                               </div>
                               <div className="h-1 bg-[#222] rounded-full overflow-hidden mb-2">
                                 <div className="h-full bg-[#d4af37]" style={{ width: `${hist.progress}%` }}></div>
                               </div>
                               <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{book.title}</h4>
                               <p className="text-[10px] text-gray-500 dark:text-[#999]">{Math.round(hist.progress)}% concluído</p>
                             </div>
                           );
                         })}
                       </div>
                    </div>
                  )}

                  {/* Metas / Reading progress placeholder */}
                  <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4af37] opacity-[0.02] rounded-full blur-[40px] pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex-1">
                        <h3 className="text-xl font-serif font-bold italic text-gray-900 dark:text-white mb-2">Meta de Leitura</h3>
                        <p className="text-sm text-gray-500 dark:text-[#999] mb-4 md:mb-0">Acompanhe seu progresso mensal e mantenha o hábito.</p>
                      </div>
                      <div className="w-full md:w-1/2">
                        <div className="flex justify-between text-xs mb-2">
                           <span className="text-[#ccc]">Livros lidos este mês</span>
                           <span className="text-[#d4af37] font-bold text-sm">
                             {readingHistory.filter(h => h.progress >= 95).length} <span className="text-gray-400 dark:text-[#666] text-xs">/ {loggedInUser?.stats?.readingGoal || 2}</span>
                           </span>
                        </div>
                        <div className="h-2.5 bg-gray-100 dark:bg-[#1a1a1a] rounded-full overflow-hidden shadow-inner">
                           <div className="h-full bg-gradient-to-r from-[#d4af37] to-[#f4d03f]" style={{ width: `${Math.min((readingHistory.filter(h => h.progress >= 95).length / (loggedInUser?.stats?.readingGoal || 2)) * 100, 100)}%` }}></div>
                        </div>
                        <button onClick={handleAdjustGoal} className="text-[10px] uppercase font-bold tracking-widest text-gray-400 dark:text-[#666] hover:text-black dark:hover:text-white transition-colors mt-3">
                          Ajustar meta 
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isEditProfileOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm shadow-xl">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-[#111] border border-gray-200 dark:border-[#333] rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
                  >
                    <button 
                      onClick={() => setIsEditProfileOpen(false)}
                      className="absolute top-4 right-4 text-gray-500 dark:text-[#999] hover:text-black dark:hover:text-white"
                    >
                      <X size={20} />
                    </button>
                    <h3 className="text-xl font-serif font-bold italic text-gray-900 dark:text-white mb-6">Editar Perfil</h3>
                    
                    <div className="flex flex-col items-center mb-6">
                      <div className="w-24 h-24 rounded-full border-2 border-dashed border-[#d4af37] relative bg-gray-100 dark:bg-[#1a1a1a] flex items-center justify-center overflow-hidden group mb-2">
                        {loggedInUser.photoUrl ? (
                          <img src={loggedInUser.photoUrl} alt="Perfil" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-3xl text-[#d4af37] font-bold">{loggedInUser.name.charAt(0).toUpperCase()}</span>
                        )}
                        <label className="absolute inset-0 bg-black/60 rounded-full opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer backdrop-blur-sm z-10">
                          <Camera size={20} className="text-white mb-1" />
                          <span className="text-[10px] uppercase font-bold text-white tracking-widest">Alterar</span>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => { 
                            handlePhotoUpload(e); 
                            if (e.target.files && e.target.files.length > 0) showToast("Enviando foto...", "info"); 
                          }} disabled={isUploadingPhoto} />
                        </label>
                        {isUploadingPhoto && (
                          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                            <div className="w-6 h-6 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                      
                      <label className="text-[10px] uppercase tracking-widest text-[#d4af37] font-bold cursor-pointer hover:underline">
                        Adicionar foto
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => { 
                            handlePhotoUpload(e); 
                            if (e.target.files && e.target.files.length > 0) showToast("Enviando foto...", "info"); 
                          }} disabled={isUploadingPhoto} />
                      </label>
                    </div>

                    <form onSubmit={handleEditProfileSubmit} className="space-y-4">
                      <div>
                        <label className="block text-gray-500 dark:text-[#999] text-xs uppercase tracking-widest font-bold mb-2">Nome Completo</label>
                        <input 
                          type="text" 
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] focus:border-[#d4af37] rounded-lg px-4 py-3 text-gray-900 dark:text-white outline-none transition-colors"
                          required
                        />
                      </div>
                      <div className="pt-2">
                        <button 
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full bg-[#d4af37] text-black font-bold uppercase tracking-wider py-3 rounded-lg hover:bg-[#f4d03f] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {isPasswordResetOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-[#111] border border-gray-300 dark:border-[#333] rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
                  >
                    <button 
                      onClick={() => setIsPasswordResetOpen(false)}
                      className="absolute top-4 right-4 text-gray-500 dark:text-[#999] hover:text-black dark:hover:text-white"
                    >
                      <X size={20} />
                    </button>
                    <h3 className="text-xl font-serif font-bold italic text-gray-900 dark:text-white mb-2">Alterar Senha</h3>
                    <p className="text-gray-500 dark:text-[#999] text-sm mb-6">Enviaremos um link de redefinição de senha para o seu email de cadastro ({loggedInUser.email}).</p>
                    <div className="pt-2 flex gap-3">
                      <button 
                        onClick={() => setIsPasswordResetOpen(false)}
                        className="flex-1 bg-transparent border border-gray-300 dark:border-[#333] text-gray-900 dark:text-[#e5e5e5] font-bold uppercase tracking-wider py-3 rounded-lg hover:border-[#666] transition-colors"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleChangePassword}
                        disabled={isSubmitting}
                        className="flex-1 bg-[#d4af37] text-black font-bold uppercase tracking-wider py-3 rounded-lg hover:bg-[#f4d03f] transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? 'Enviando...' : 'Enviar Link'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {isPreferencesOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-[#111] border border-gray-300 dark:border-[#333] rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
                  >
                    <button 
                      onClick={() => setIsPreferencesOpen(false)}
                      className="absolute top-4 right-4 text-gray-500 dark:text-[#999] hover:text-black dark:hover:text-white"
                    >
                      <X size={20} />
                    </button>
                    <h3 className="text-xl font-serif font-bold italic text-gray-900 dark:text-white mb-6">Preferências</h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-900 dark:text-white font-medium text-sm">Modo Escuro</p>
                          <p className="text-gray-400 dark:text-[#666] text-xs">Ativar o tema escuro no aplicativo</p>
                        </div>
                        <button 
                          onClick={() => setDarkMode(!darkMode)}
                          className={`w-12 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-[#d4af37]' : 'bg-[#333]'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-900 dark:text-white font-medium text-sm">Notificações</p>
                          <p className="text-gray-400 dark:text-[#666] text-xs">Receber alertas e novidades da MozBooks</p>
                        </div>
                        <button 
                          onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                          className={`w-12 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-[#d4af37]' : 'bg-[#333]'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </>
          ) : (
              <div className="bg-white dark:bg-[#111] rounded-2xl shadow-xl border border-gray-200 dark:border-[#222] p-8 sm:p-10 relative overflow-hidden">
                {authMode === 'onboarding' ? (
                  <div className="animate-in fade-in zoom-in duration-500 text-center">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-[#1a1a1a] rounded-full mx-auto flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                      <Star className="text-[#d4af37]" size={32} />
                    </div>
                    <h2 className="text-3xl font-serif font-bold italic text-gray-900 dark:text-white mb-3">Bem-vindo, {name || loggedInUser?.name}!</h2>
                    <p className="text-sm text-[#777] mb-8">Para deixarmos o MozBooks com a sua cara, nos conte quais gêneros literários você mais gosta.</p>
                    
                    <div className="flex flex-wrap gap-3 justify-center mb-10">
                      {CATEGORIES.map(cat => {
                        const isSelected = selectedOnboardingGenres.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setSelectedOnboardingGenres(prev => 
                                isSelected ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                              )
                            }}
                            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                              isSelected 
                                ? 'bg-[#d4af37] border-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-105' 
                                : 'bg-transparent border-gray-300 dark:border-[#333] text-gray-500 dark:text-[#999] hover:border-[#d4af37] hover:text-black dark:hover:text-white'
                            }`}
                          >
                            {cat.name}
                          </button>
                        )
                      })}
                    </div>

                    <button 
                       onClick={handleFinishOnboarding}
                       disabled={isSubmitting || selectedOnboardingGenres.length === 0}
                       className="w-full bg-[#d4af37] hover:bg-[#f4d03f] text-black font-bold uppercase tracking-wider text-xs py-3.5 rounded mt-4 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Salvando...' : 'Finalizar Setup'}
                    </button>
                  </div>
                ) : (
                  <>
                  <div className="text-center mb-8">
                    <Logo className="h-16 md:h-20 mx-auto mb-8 drop-shadow-2xl" />
                    <h2 className="text-3xl font-serif font-bold italic text-gray-900 dark:text-white mb-3">
                      {authMode === 'login' ? 'Bem-vindo de volta' : authMode === 'register' ? 'Criar Conta' : 'Recuperar Senha'}
                    </h2>
                    <p className="text-sm text-[#777]">
                      {authMode === 'login' ? 'Acesse sua biblioteca pessoal e salve seus favoritos.' : 
                       authMode === 'register' ? 'Junte-se a nós para ter acesso a dezenas de livros gratuitos.' : 
                       'Insira seu e-mail para receber um link de recuperação.'}
                    </p>
                  </div>

                  {authError && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded text-xs font-medium text-center">
                      {authError}
                    </div>
                  )}
                  
                  {authSuccess && (
                    <div className="mb-6 bg-green-500/10 border border-green-500/30 text-green-500 px-4 py-3 rounded text-xs font-medium text-center">
                      {authSuccess}
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    {authMode === 'register' && (
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5 flex items-center gap-2">
                          <User size={12} /> Nome Completo
                        </label>
                        <input 
                          type="text" 
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all"
                          placeholder="Mário Silva"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5 flex items-center gap-2">
                        <Mail size={12} /> E-mail
                      </label>
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all"
                        placeholder="seu@email.com"
                      />
                    </div>

                    {authMode !== 'forgot_password' && (
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold flex items-center gap-2">
                            <Lock size={12} /> Senha
                          </label>
                          {authMode === 'login' && (
                           <button 
                              type="button" 
                              onClick={() => { setAuthMode('forgot_password'); clearAuthErrors(); }}
                              className="text-[10px] uppercase tracking-widest text-[#d4af37] hover:text-black dark:hover:text-white transition-colors"
                            >
                              Esqueceu?
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input 
                            type={showPassword ? "text" : "password"} 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all pr-10"
                            placeholder="••••••••"
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#666] hover:text-gray-900 dark:text-[#e5e5e5]"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {authMode === 'register' && (
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5 flex items-center gap-2">
                          <Lock size={12} /> Confirmar Senha
                        </label>
                        <div className="relative">
                          <input 
                            type={showConfirmPassword ? "text" : "password"} 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all pr-10"
                            placeholder="••••••••"
                          />
                          <button 
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#666] hover:text-gray-900 dark:text-[#e5e5e5]"
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full bg-[#d4af37] hover:bg-[#f4d03f] text-black font-bold uppercase tracking-wider text-xs py-3.5 rounded mt-4 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <span className="animate-pulse">Aguarde...</span>
                      ) : (
                        authMode === 'login' ? 'Entrar na Conta' : 
                        authMode === 'register' ? 'Criar Conta' : 
                        'Enviar Link de Recuperação'
                      )}
                    </button>
                  </form>

                  {authMode !== 'forgot_password' && (
                    <>
                      <div className="flex items-center my-6">
                        <div className="flex-1 h-[1px] bg-[#333]"></div>
                        <span className="px-4 text-[10px] uppercase text-gray-400 dark:text-[#666] tracking-widest font-bold">Ou entre com</span>
                        <div className="flex-1 h-[1px] bg-[#333]"></div>
                      </div>

                      <button 
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={isSubmitting}
                        className="w-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] hover:bg-[#222] hover:border-[#d4af37] text-gray-900 dark:text-white font-medium py-3 px-6 rounded flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.89 16.81 15.75 17.58V20.34H19.32C21.41 18.42 22.56 15.59 22.56 12.25Z" fill="#4285F4"/>
                          <path d="M12 23C14.97 23 17.46 22.02 19.32 20.34L15.75 17.58C14.74 18.26 13.48 18.66 12 18.66C9.13 18.66 6.7 16.73 5.82 14.12H2.15V16.97C4.01 20.66 7.86 23 12 23Z" fill="#34A853"/>
                          <path d="M5.82 14.12C5.59 13.46 5.46 12.75 5.46 12C5.46 11.25 5.59 10.54 5.82 9.88V7.03H2.15C1.39 8.56 0.95 10.24 0.95 12C0.95 13.76 1.39 15.44 2.15 16.97L5.82 14.12Z" fill="#FBBC05"/>
                          <path d="M12 5.34C13.62 5.34 15.06 5.89 16.2 6.99L19.39 3.8C17.45 1.99 14.96 0.95 12 0.95C7.86 0.95 4.01 3.34 2.15 7.03L5.82 9.88C6.7 7.27 9.13 5.34 12 5.34Z" fill="#EA4335"/>
                        </svg>
                        Google
                      </button>
                    </>
                  )}

                  <div className="mt-8 text-center border-t border-gray-200 dark:border-[#222] pt-6">
                    {authMode === 'login' ? (
                      <p className="text-xs text-gray-500 dark:text-[#999]">
                        Não tem uma conta? <button onClick={() => { setAuthMode('register'); clearAuthErrors(); }} className="text-[#d4af37] hover:text-black dark:hover:text-white transition-colors font-bold uppercase tracking-wider ml-1">Criar Agora</button>
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-[#999]">
                        {authMode === 'register' ? 'Já tem uma conta?' : 'Lembrou a senha?'} 
                        <button onClick={() => { setAuthMode('login'); clearAuthErrors(); }} className="text-[#d4af37] hover:text-black dark:hover:text-white transition-colors font-bold uppercase tracking-wider ml-2">Fazer Login</button>
                      </p>
                    )}
                  </div>
                  </>
                )}

                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#d4af37] opacity-[0.03] blur-[60px] rounded-full pointer-events-none"></div>
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#d4af37] opacity-[0.03] blur-[60px] rounded-full pointer-events-none"></div>
              </div>
            )}
          </motion.div>
        )}

        {currentView === 'admin' && loggedInUser?.isAdmin && (
          <motion.div 
            key="admin"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-6xl mx-auto relative mt-4 md:mt-8 pb-24 md:pb-8"
          >
            <div className="flex items-center gap-4 mb-6 px-4">
              <button 
                onClick={() => setCurrentView('profile')}
                className="p-2 border border-gray-300 dark:border-[#333] rounded hover:bg-gray-100 dark:hover:bg-[#111] transition-colors"
                title="Voltar ao Perfil"
              >
                <ChevronLeft size={20} className="text-gray-900 dark:text-white" />
              </button>
              <div>
                <h1 className="text-3xl font-serif font-bold italic text-gray-900 dark:text-white">Central de Administração</h1>
                <p className="text-sm text-[#777]">Controle total sobre o conteúdo e dados da plataforma.</p>
              </div>
            </div>
            <div className="px-4">
              <AdminPanel books={books} />
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      {currentView !== 'reading' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0a0a0a]/90 backdrop-blur-lg border-t border-gray-200 dark:border-[#222] z-50 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex justify-between items-center">
          <button 
            onClick={() => { setCurrentView('home'); setSelectedCategory(null); setSearchSchoolClass(''); setSearchSubject(''); }}
            className={`flex flex-col items-center gap-1 ${currentView === 'home' ? 'text-[#d4af37]' : 'text-gray-400 dark:text-[#666] hover:text-gray-500 dark:text-[#999]'}`}
          >
            <Home size={20} />
            <span className="text-[9px] uppercase tracking-widest font-bold">Início</span>
          </button>
          
          <button 
            onClick={() => { setCurrentView('home'); setIsMobileMenuOpen(true); setTimeout(() => (document.querySelector('input[type="text"]') as HTMLInputElement)?.focus(), 100); }}
            className={`flex flex-col items-center gap-1 ${isMobileMenuOpen ? 'text-[#d4af37]' : 'text-gray-400 dark:text-[#666] hover:text-gray-500 dark:text-[#999]'}`}
          >
            <Search size={20} />
            <span className="text-[9px] uppercase tracking-widest font-bold">Busca</span>
          </button>

          <button 
            onClick={() => setCurrentView('favorites')}
            className={`flex flex-col items-center gap-1 ${currentView === 'favorites' ? 'text-[#d4af37]' : 'text-gray-400 dark:text-[#666] hover:text-gray-500 dark:text-[#999]'}`}
          >
            <Heart size={20} />
            <span className="text-[9px] uppercase tracking-widest font-bold">Salvos</span>
          </button>

          <button 
            onClick={() => setCurrentView('profile')}
            className={`flex flex-col items-center gap-1 ${currentView === 'profile' ? 'text-[#d4af37]' : 'text-gray-400 dark:text-[#666] hover:text-gray-500 dark:text-[#999]'}`}
          >
            <User size={20} />
            <span className="text-[9px] uppercase tracking-widest font-bold">Perfil</span>
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest shadow-2xl flex items-center gap-2 border ${
            toast.type === 'success' ? 'bg-[#0f1f10] text-[#4ade80] border-[#4ade80]/30' : 
            toast.type === 'error' ? 'bg-[#1f0f0f] text-[#f87171] border-[#f87171]/30' : 
            'bg-black/80 text-white border-gray-300 dark:border-[#333] backdrop-blur-md'
          }`}>
            {toast.message}
          </div>
        </div>
      )}

    </div>
  );
}
