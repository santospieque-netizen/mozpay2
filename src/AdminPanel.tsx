import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, storage } from './firebase';
import { supabase } from './supabase';
import { collection, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { CATEGORIES, Book, SCHOOL_CLASSES, SCHOOL_SUBJECTS } from './data';
import { Upload, FileText, Image as ImageIcon, Loader2, BarChart3, LayoutList, Plus, Trash2, Edit, Download, Sparkles } from 'lucide-react';

export default function AdminPanel({ books }: { books: Book[] }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'form'>('dashboard');
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [language, setLanguage] = useState('Português');
  const [schoolClass, setSchoolClass] = useState('');
  const [subject, setSubject] = useState('');
  const [year, setYear] = useState('');
  const [summary, setSummary] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [tags, setTags] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [useUrlForCover, setUseUrlForCover] = useState(true);
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [useUrlForPdf, setUseUrlForPdf] = useState(true);
  const [pdfUrlInput, setPdfUrlInput] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // Dashboard calculations
  const totalDownloads = books.reduce((acc, book) => acc + (book.downloads || Math.floor(book.rating * 12)), 0);
  const popularBooks = [...books].sort((a, b) => (b.downloads ?? (b.rating * 10)) - (a.downloads ?? (a.rating * 10))).slice(0, 5);

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setDescription('');
    setCategoryId(CATEGORIES[0].id);
    setLanguage('Português');
    setSchoolClass('');
    setSubject('');
    setYear('');
    setSummary('');
    setSynopsis('');
    setTags('');
    setCoverFile(null);
    setPdfFile(null);
    setCoverUrlInput('');
    setPdfUrlInput('');
    setEditingBookId(null);
    setMessage(null);
    setProgress(0);
  };

  const handleEdit = (book: Book) => {
    resetForm();
    setEditingBookId(book.id);
    setTitle(book.title);
    setAuthor(book.author);
    setDescription(book.description);
    setCategoryId(book.categoryId);
    setLanguage(book.language || 'Português');
    setSchoolClass(book.schoolClass || '');
    setSubject(book.subject || '');
    setYear(book.year || '');
    setSummary(book.summary || '');
    setSynopsis(book.synopsis || '');
    setTags(book.tags ? book.tags.join(', ') : '');
    setCoverUrlInput(book.coverUrl);
    setUseUrlForCover(true);
    if (book.pdfUrl) {
      setPdfUrlInput(book.pdfUrl);
      setUseUrlForPdf(true);
    }
    setActiveTab('form');
  };

  const handleDelete = async (book: Book) => {
    try {
      await deleteDoc(doc(db, 'books', book.id));
      setMessage({ text: 'Livro apagado com sucesso.', type: 'success' });
      setBookToDelete(null);
    } catch(e: any) {
      setMessage({ text: 'Erro ao apagar: ' + e.message, type: 'error' });
      setBookToDelete(null);
    }
  };

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const handleGenerateAI = async () => {
    if (!title || !author) {
      setMessage({ text: 'Por favor, preencha o Título e Autor primeiro para gerar a descrição com IA.', type: 'error' });
      return;
    }

    setIsGeneratingAI(true);
    setMessage({ text: 'Gerando conteúdo com IA... (Isso pode levar alguns segundos)', type: 'success' });
    try {
      const { GoogleGenAI, Type } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Gere informações para o livro "${title}" do autor "${author}".
Atue como um especialista em literatura. Crie um resumo conciso (1 parágrafo), uma sinopse profissional (2-3 parágrafos), sugira 5-8 tags relevantes separadas por vírgula e também escolha a categoria que melhor se ajusta entre as opções (seja preciso na string do ID). Note: Categoria ID possíveis são: 'estudantis', 'romance', 'historia', 'motivacionais', 'religiosos'. Se nenhuma for perfeita, escolha a mais próxima.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: 'Mini resumo automático' },
              synopsis: { type: Type.STRING, description: 'Sinopse profissional' },
              tags: { type: Type.STRING, description: 'Tags separadas por vírgula' },
              categoryId: { type: Type.STRING, description: 'ID da Categoria sugerida' },
            },
            required: ['summary', 'synopsis', 'tags', 'categoryId']
          }
        }
      });
      
      const resultText = response.text.trim();
      const resultObj = JSON.parse(resultText);
      
      if (resultObj.summary) setSummary(resultObj.summary);
      if (resultObj.synopsis) {
        setSynopsis(resultObj.synopsis);
        // Se a descrição estiver vazia, podemos preencher com a sinopse também
        if (!description) setDescription(resultObj.synopsis);
      }
      if (resultObj.tags) setTags(resultObj.tags);
      if (resultObj.categoryId && CATEGORIES.some(c => c.id === resultObj.categoryId)) {
        setCategoryId(resultObj.categoryId);
      }
      
      setMessage({ text: 'Conteúdo gerado com sucesso pela IA!', type: 'success' });
    } catch (error: any) {
      console.error("Erro na geração com IA:", error);
      setMessage({ text: 'Falha ao gerar conteúdo com IA.', type: 'error' });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingBookId) {
      const hasCover = (useUrlForCover && coverUrlInput) || (!useUrlForCover && coverFile);
      const hasPdf = (useUrlForPdf && pdfUrlInput) || (!useUrlForPdf && pdfFile);
      if (!title || !author || !description || !hasCover || !hasPdf) {
        setMessage({ text: 'Preencha todos os campos obrigatórios e forneça os arquivos/links.', type: 'error' });
        return;
      }
    }

    setIsUploading(true);
    setProgress(0);
    setMessage(null);

    try {
      let currentCoverUrl = editingBookId ? books.find(b => b.id === editingBookId)?.coverUrl || '' : '';
      let currentPdfUrl = editingBookId ? books.find(b => b.id === editingBookId)?.pdfUrl || '' : '';

      const uploadTasks: Promise<void>[] = [];
      
      if (!useUrlForCover && coverFile) {
        const coverRef = ref(storage, `covers/${Date.now()}_${coverFile.name}`);
        const coverUpload = uploadBytesResumable(coverRef, coverFile);
        uploadTasks.push(
          new Promise((resolve, reject) => {
            coverUpload.on('state_changed', null, reject, async () => {
              currentCoverUrl = await getDownloadURL(coverRef);
              resolve();
            });
          })
        );
      } else if (useUrlForCover && coverUrlInput) {
        currentCoverUrl = coverUrlInput;
      }

      if (!useUrlForPdf && pdfFile) {
        const pdfRef = ref(storage, `books/${Date.now()}_${pdfFile.name}`);
        const pdfUpload = uploadBytesResumable(pdfRef, pdfFile);
        uploadTasks.push(
          new Promise((resolve, reject) => {
            pdfUpload.on('state_changed', snapshot => {
              const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setProgress(p);
            }, reject, async () => {
              currentPdfUrl = await getDownloadURL(pdfRef);
              resolve();
            });
          })
        );
      } else if (useUrlForPdf && pdfUrlInput) {
        currentPdfUrl = pdfUrlInput;
      }

      // Wait for all file uploads to complete
      await Promise.all(uploadTasks);

      const bookData = {
        title,
        author,
        description,
        categoryId,
        language,
        schoolClass,
        subject,
        year,
        summary,
        synopsis,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        coverUrl: currentCoverUrl,
        pdfUrl: currentPdfUrl,
        rating: 5.0,
        downloads: 0,
        createdAt: new Date().toISOString()
      };

      // Save to Supabase (Primary)
      try {
        const { error: supabaseError } = await (supabase as any)
          .from('books')
          .upsert(editingBookId ? { id: editingBookId, ...bookData } : bookData);
        
        if (supabaseError) {
          console.error("Error saving to Supabase:", supabaseError.message);
        }
      } catch (err) {
        console.error("Supabase Save Exception:", err);
      }

      if (editingBookId) {
        await updateDoc(doc(db, 'books', editingBookId), {
          ...bookData,
          // Remove createdAt from updates to preserve original
          createdAt: undefined 
        });
        setMessage({ text: 'Livro atualizado com sucesso!', type: 'success' });
        setActiveTab('list');
      } else {
        await addDoc(collection(db, 'books'), bookData);
        setMessage({ text: 'Livro publicado com sucesso!', type: 'success' });
        resetForm();
      }
    } catch (error: any) {
      console.error(error);
      const isPermissionError = error.message && error.message.includes('permission-denied');
      setMessage({ 
        text: isPermissionError ? 'Permissão negada. Você precisa configurar as Storage Rules no Firebase Console (Storage -> Rules) para permitir o upload. Mude para "allow read, write: if true;" temporariamente para testar.' : `Erro: ${error.message}`, 
        type: 'error' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111] rounded-2xl shadow-xl border border-gray-200 dark:border-[#222] p-8 mt-8 col-span-full w-full">
      <h3 className="text-xl font-serif font-bold italic text-gray-900 dark:text-white mb-2">Painel de Administrador</h3>
      <p className="text-sm text-[#777] mb-6">Poderes de super-usuário para gerenciar a plataforma MozBooks.</p>

      {/* Admin Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-300 dark:border-[#333] pb-2 overflow-x-auto">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`pb-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'dashboard' ? 'text-[#d4af37] border-b-2 border-[#d4af37]' : 'text-gray-400 dark:text-[#666] hover:text-black dark:hover:text-white'}`}
        >
          <BarChart3 size={14} /> Estatísticas
        </button>
        <button 
          onClick={() => setActiveTab('list')} 
          className={`pb-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'list' ? 'text-[#d4af37] border-b-2 border-[#d4af37]' : 'text-gray-400 dark:text-[#666] hover:text-black dark:hover:text-white'}`}
        >
          <LayoutList size={14} /> Gerenciar Livros
        </button>
        <button 
          onClick={() => { setActiveTab('form'); resetForm(); }} 
          className={`pb-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'form' ? 'text-[#d4af37] border-b-2 border-[#d4af37]' : 'text-gray-400 dark:text-[#666] hover:text-black dark:hover:text-white'}`}
        >
          <Plus size={14} /> {editingBookId ? 'Editar Livro' : 'Adicionar Novo'}
        </button>
      </div>

      <AnimatePresence mode="wait">
      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className={`p-4 rounded text-xs mb-6 ${message.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-green-500/10 text-green-500 border border-green-500/30'}`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Tab Content: Dashboard */}
      {activeTab === 'dashboard' && (
        <motion.div 
          key="dashboard"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-100 dark:bg-[#1a1a1a] rounded-lg border border-gray-300 dark:border-[#333] p-5 text-left">
              <h4 className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-2">Total de Livros</h4>
              <span className="text-4xl shadow-sm text-gray-900 dark:text-[#e5e5e5] font-serif">{books.length}</span>
            </div>
            <div className="bg-gray-100 dark:bg-[#1a1a1a] rounded-lg border border-gray-300 dark:border-[#333] p-5 text-left">
              <h4 className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-2">Total de Downloads</h4>
              <span className="text-4xl shadow-sm text-gray-900 dark:text-[#e5e5e5] font-serif">{totalDownloads}</span>
            </div>
            <div className="bg-gray-100 dark:bg-[#1a1a1a] rounded-lg border border-gray-300 dark:border-[#333] p-5 text-left">
              <h4 className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-2">Categorias Ativas</h4>
              <span className="text-4xl shadow-sm text-gray-900 dark:text-[#e5e5e5] font-serif">{CATEGORIES.length}</span>
            </div>
          </div>

          <div className="text-left">
            <h4 className="text-sm uppercase tracking-widest text-gray-900 dark:text-[#e5e5e5] font-bold mb-4">Livros Mais Populares</h4>
            <div className="space-y-3">
              {popularBooks.map((book, index) => (
                <div key={book.id} className="bg-gray-50 dark:bg-[#151515] hover:bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#222] hover:border-gray-300 dark:border-[#333] rounded-lg p-3 flex items-center gap-4 transition-colors relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#d4af37]/5 to-transparent w-[200%] -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  <div className="w-8 flex-shrink-0 text-center font-bold text-[#d4af37] text-lg">#{index + 1}</div>
                  <img src={book.coverUrl} alt={book.title} className="w-10 h-14 object-cover rounded shadow-sm opacity-90 group-hover:opacity-100 transition-opacity" />
                  <div className="flex-1">
                    <h5 className="text-sm font-bold text-gray-900 dark:text-[#e5e5e5] group-hover:text-[#d4af37] transition-colors">{book.title}</h5>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#666] font-bold mt-0.5">{book.author}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-900 dark:text-[#e5e5e5] flex items-center justify-end gap-1.5"><Download size={12} className="text-gray-400 dark:text-[#666] group-hover:text-[#d4af37] transition-colors"/> {book.downloads || Math.floor(book.rating * 12)}</div>
                    <div className="text-[9px] text-gray-400 dark:text-[#666] mt-0.5 uppercase tracking-widest">Downloads</div>
                  </div>
                </div>
              ))}
              {popularBooks.length === 0 && <p className="text-xs text-gray-400 dark:text-[#666]">Nenhum livro disponível no momento.</p>}
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab Content: Livros */}
      {activeTab === 'list' && (
        <motion.div 
          key="list"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-900 dark:text-[#e5e5e5] border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-300 dark:border-[#333] text-gray-400 dark:text-[#666] text-[10px] uppercase tracking-widest">
                  <th className="py-3 px-4 w-12">#</th>
                  <th className="py-3 px-4">Informações do Livro</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book, index) => (
                  <tr key={book.id} className="border-b border-gray-200 dark:border-[#222] hover:bg-gray-100 dark:bg-[#1a1a1a]/50 transition-colors">
                    <td className="py-3 px-4 text-xs font-mono text-gray-400 dark:text-[#666]">{index + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img src={book.coverUrl} alt={book.title} className="w-8 h-10 object-cover rounded" />
                        <div>
                          <div className="text-xs font-bold text-gray-900 dark:text-[#e5e5e5] truncate max-w-[200px]">{book.title}</div>
                          <div className="text-[10px] text-[#777] truncate max-w-[200px]">{book.author}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-gray-500 dark:text-[#999]">
                      <div className="text-gray-900 dark:text-[#e5e5e5]">{CATEGORIES.find(c => c.id === book.categoryId)?.name || 'Sem Categoria'}</div>
                      {book.schoolClass && <div className="text-[10px] mt-0.5">{book.schoolClass}</div>}
                      {book.subject && <div className="text-[10px]">{book.subject} {book.year ? `(${book.year})` : ''}</div>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(book)}
                          className="p-1.5 text-gray-500 dark:text-[#999] hover:text-black dark:hover:text-white bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] hover:border-[#d4af37] rounded transition-all"
                          title="Editar"
                        >
                          <Edit size={14} />
                        </button>
                        {bookToDelete?.id === book.id ? (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleDelete(book)}
                              className="text-[9px] uppercase tracking-widest font-bold px-2 py-1.5 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors"
                            >
                              Confirmar
                            </button>
                            <button 
                              onClick={() => setBookToDelete(null)}
                              className="text-[9px] uppercase tracking-widest font-bold px-2 py-1.5 bg-gray-200 dark:bg-[#333] text-gray-600 dark:text-[#999] hover:text-black dark:hover:text-white rounded transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setBookToDelete(book)}
                            className="p-1.5 text-gray-500 dark:text-[#999] hover:text-red-500 bg-gray-100 dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] hover:border-red-500/50 hover:bg-red-500/10 rounded transition-all"
                            title="Apagar"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {books.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-gray-400 dark:text-[#666]">Nenhum livro catalogado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Tab Content: Formulário */}
      {activeTab === 'form' && (
        <motion.form 
          key="form"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          onSubmit={handleSave} 
          className="space-y-4 text-left"
        >
          <h4 className="text-sm uppercase tracking-widest text-[#d4af37] font-bold mb-4">{editingBookId ? 'Editar Livro' : 'Adicionar Novo Livro'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5">Título do Livro</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-50 dark:bg-[#151515] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:bg-white dark:focus:bg-[#111] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all shadow-inner" required />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5">Autor</label>
              <input type="text" value={author} onChange={e => setAuthor(e.target.value)} className="w-full bg-gray-50 dark:bg-[#151515] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:bg-white dark:focus:bg-[#111] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all shadow-inner" required />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5">Categoria</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-gray-50 dark:bg-[#151515] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:bg-white dark:focus:bg-[#111] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all shadow-inner" required>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5">Idioma</label>
              <input type="text" value={language} onChange={e => setLanguage(e.target.value)} placeholder="Ex: Português, Inglês" className="w-full bg-gray-50 dark:bg-[#151515] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:bg-white dark:focus:bg-[#111] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all shadow-inner" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5">Classe Escolar</label>
              <select value={schoolClass} onChange={e => setSchoolClass(e.target.value)} className="w-full bg-gray-50 dark:bg-[#151515] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:bg-white dark:focus:bg-[#111] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all shadow-inner">
                <option value="">Selecione (Opcional)</option>
                {SCHOOL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {schoolClass && (
              <>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5">Disciplina</label>
                  <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full bg-gray-50 dark:bg-[#151515] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:bg-white dark:focus:bg-[#111] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all shadow-inner">
                    <option value="">Selecione</option>
                    {SCHOOL_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5">Ano (Opcional)</label>
                  <input type="text" value={year} onChange={e => setYear(e.target.value)} placeholder="Ex: 2023" className="w-full bg-gray-50 dark:bg-[#151515] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:bg-white dark:focus:bg-[#111] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all shadow-inner" />
                </div>
              </>
            )}
          </div>

          <div className="bg-[#fcfbf9] dark:bg-[#1a1a1a] p-5 rounded-2xl border border-gray-200 dark:border-[#333]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
              <div>
                <h5 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest font-sans flex items-center gap-2">
                  Detalhes do Livro
                </h5>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Gere automaticamente usando Inteligência Artificial ou preencha manualmente</p>
              </div>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={isGeneratingAI}
                className="flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#d4af37] dark:hover:bg-[#d4af37] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGeneratingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Gerar com IA
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5">Mini Resumo</label>
                <input type="text" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Resumo de uma linha..." className="w-full bg-white dark:bg-[#111] hover:bg-gray-50 dark:hover:bg-[#151515] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all shadow-sm" />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5">Sinopse/Descrição Central</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Descrição principal do livro..." className="w-full bg-white dark:bg-[#111] hover:bg-gray-50 dark:hover:bg-[#151515] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all shadow-sm" required />
              </div>
              
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5">Sinopse Profissional (Opcional)</label>
                <textarea value={synopsis} onChange={e => setSynopsis(e.target.value)} rows={4} placeholder="Uma sinopse mais detalhada..." className="w-full bg-white dark:bg-[#111] hover:bg-gray-50 dark:hover:bg-[#151515] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all shadow-sm" />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-400 dark:text-[#666] font-bold mb-1.5">Tags (separadas por vírgula)</label>
                <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="Ficção científica, aventura, tecnologia..." className="w-full bg-white dark:bg-[#111] hover:bg-gray-50 dark:hover:bg-[#151515] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all shadow-sm" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="bg-gray-50 dark:bg-[#151515] border border-gray-200 dark:border-[#222] p-4 rounded-2xl relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4 relative z-10">
                <label className="block text-[10px] uppercase tracking-widest text-gray-900 dark:text-[#e5e5e5] font-bold">Capa do Livro</label>
                <button type="button" onClick={() => setUseUrlForCover(!useUrlForCover)} className="text-[10px] uppercase tracking-widest text-[#d4af37] hover:text-[#f4d03f] font-bold bg-[#d4af37]/10 px-2 py-1 rounded">
                  {useUrlForCover ? 'Fazer Upload' : 'Usar Link'}
                </button>
              </div>
              {useUrlForCover ? (
                <input type="url" value={coverUrlInput} onChange={e => setCoverUrlInput(e.target.value)} placeholder="https://exemplo.com/capa.jpg" className="w-full relative z-10 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all" required={!editingBookId} />
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-[#333] hover:border-[#d4af37] dark:hover:border-[#d4af37] py-6 px-4 rounded-xl cursor-pointer transition-colors bg-white dark:bg-[#1a1a1a] relative z-10">
                  <ImageIcon size={32} className={`${coverFile ? 'text-[#d4af37]' : 'text-gray-400 dark:text-[#666]'} mb-3 transition-colors`} />
                  <span className="text-xs font-bold text-gray-900 dark:text-[#e5e5e5] block text-center mb-1">{coverFile ? 'Arquivo Selecionado' : 'Fazer Upload (JPG/PNG)'}</span>
                  <span className="text-[10px] text-[#777] block text-center truncate max-w-[200px]">{coverFile?.name || (editingBookId && !useUrlForCover ? '(Manter a capa atual)' : 'Nenhum arquivo de capa selecionado')}</span>
                  <input type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] || null)} className="hidden" required={!editingBookId && !coverFile && !useUrlForCover} />
                </label>
              )}
            </div>
            
            <div className="bg-gray-50 dark:bg-[#151515] border border-gray-200 dark:border-[#222] p-4 rounded-2xl relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4 relative z-10">
                <label className="block text-[10px] uppercase tracking-widest text-gray-900 dark:text-[#e5e5e5] font-bold">Arquivo PDF</label>
                <button type="button" onClick={() => setUseUrlForPdf(!useUrlForPdf)} className="text-[10px] uppercase tracking-widest text-[#d4af37] hover:text-[#f4d03f] font-bold bg-[#d4af37]/10 px-2 py-1 rounded">
                  {useUrlForPdf ? 'Fazer Upload' : 'Usar Link'}
                </button>
              </div>
              {useUrlForPdf ? (
                <input type="url" value={pdfUrlInput} onChange={e => setPdfUrlInput(e.target.value)} placeholder="https://exemplo.com/livro.pdf" className="w-full relative z-10 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e5e5e5] focus:border-[#d4af37] focus:outline-none focus:ring-1 focus:ring-[#d4af37] transition-all" required={!editingBookId} />
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-[#333] hover:border-[#d4af37] dark:hover:border-[#d4af37] py-6 px-4 rounded-xl cursor-pointer transition-colors bg-white dark:bg-[#1a1a1a] relative z-10">
                  <FileText size={32} className={`${pdfFile ? 'text-[#d4af37]' : 'text-gray-400 dark:text-[#666]'} mb-3 transition-colors`} />
                  <span className="text-xs font-bold text-gray-900 dark:text-[#e5e5e5] block text-center mb-1">{pdfFile ? 'Arquivo Selecionado' : 'Fazer Upload PDF'}</span>
                  <span className="text-[10px] text-[#777] block text-center truncate max-w-[200px]">{pdfFile?.name || (editingBookId && !useUrlForPdf ? '(Manter o PDF atual)' : 'Nenhum arquivo PDF selecionado')}</span>
                  <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} className="hidden" required={!editingBookId && !pdfFile && !useUrlForPdf} />
                </label>
              )}
            </div>
          </div>

          {isUploading && (
            <div className="w-full bg-gray-100 dark:bg-[#1a1a1a] rounded h-2 overflow-hidden mt-6 mb-2">
              <div className="bg-[#d4af37] h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          )}

          <div className="flex gap-4 mt-8 pt-4 border-t border-gray-200 dark:border-[#222]">
            {editingBookId && (
               <button 
                 type="button"
                 onClick={() => { resetForm(); setActiveTab('list') }}
                 className="flex-1 bg-transparent hover:bg-gray-50 border border-[#444] hover:border-gray-900 dark:hover:bg-[#1a1a1a] dark:hover:border-white text-gray-500 dark:text-[#999] hover:text-black dark:hover:text-white font-bold uppercase tracking-wider text-xs py-4 rounded-full transition-all"
               >
                 Cancelar
               </button>
            )}
            <button 
              type="submit" 
              disabled={isUploading}
              className={`flex-[2] bg-[#d4af37] text-black font-bold uppercase tracking-wider text-xs py-4 rounded-full transition-all flex justify-center items-center gap-2 disabled:opacity-50 ${isUploading ? 'opacity-75 cursor-not-allowed' : 'hover:bg-[#f4d03f] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:scale-[1.02]'}`}
            >
              {isUploading ? <><Loader2 size={16} className="animate-spin" /> {Math.round(progress)}% Concluído</> : <><Upload size={16} /> {editingBookId ? 'Salvar Alterações' : 'Publicar Livro'}</>}
            </button>
          </div>
        </motion.form>
      )}
      </AnimatePresence>

    </div>
  );
}
