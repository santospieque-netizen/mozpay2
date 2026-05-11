import React from 'react';
import { Star, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Book } from '../data';

interface BookCardProps {
  book: Book;
  isFavorite: boolean;
  onBookClick: (book: Book) => void;
  onToggleFavorite: (e: React.MouseEvent, bookId: string) => void;
  className?: string;
}

const BookCard: React.FC<BookCardProps> = ({ book, isFavorite, onBookClick, onToggleFavorite, className = '' }) => {
  return (
    <motion.div 
      className={`group cursor-pointer flex flex-col flex-shrink-0 snap-start ${className}`}
      onClick={() => onBookClick(book)}
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#1a1a1a] mb-3 border border-[#222] group-hover:border-[#d4af37] shadow-lg group-hover:shadow-[0_15px_35px_rgba(212,175,55,0.2)] transition-all duration-300">
        <img 
          src={book.coverUrl} 
          alt={book.title} 
          className="object-cover w-full h-full opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out" 
          loading="lazy"
        />
        
        {/* Rating Badge */}
        <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded text-[9px] font-bold text-[#d4af37] border border-[#333] flex items-center gap-1 shadow-black/50 shadow-md">
          <Star size={10} className="fill-[#d4af37]"/> {book.rating}
        </div>

        {/* Favorite Button Overlay */}
        <button 
          onClick={(e) => onToggleFavorite(e, book.id)}
          className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all duration-300 z-10 
            ${isFavorite ? 'bg-black/80 border-[#d4af37] opacity-100' : 'bg-black/40 border-[#333] opacity-0 group-hover:opacity-100 group-hover:bg-black/60'} 
            border hover:border-[#d4af37] hover:bg-black/80`}
        >
          <Heart size={14} className={isFavorite ? "fill-[#d4af37] text-[#d4af37]" : "text-[#999] group-hover:text-white"} />
        </button>

        {/* Netflix style hover info bottom */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out flex flex-col justify-end">
          <span className="text-[10px] text-[#d4af37] font-bold uppercase tracking-wider mb-1">{book.categoryId}</span>
          <p className="text-white text-xs font-medium line-clamp-2 leading-tight">{book.summary || book.description}</p>
        </div>
      </div>
      
      <h4 className="text-xs font-bold truncate text-[#e5e5e5] group-hover:text-[#d4af37] transition-colors">{book.title}</h4>
      <p className="text-[10px] text-[#666] truncate mt-0.5">{book.author}</p>
    </motion.div>
  );
};

export default BookCard;
