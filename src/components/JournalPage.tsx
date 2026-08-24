import { useState } from 'react'
import { getArticle, JOURNAL } from '../data/products'
import { Link, useDocumentMeta, useJsonLd } from '../lib/router'
import BlurText from './BlurText'

export function JournalArticlePage({ id }: { id?: string }) {
  const article = getArticle(id)

  useDocumentMeta(
    article ? `${article.title}  The Elegant Sip Journal` : 'Journal  Elegant Sip',
    article ? article.excerpt : undefined,
  )
  useJsonLd(
    article
      ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.excerpt,
        image: article.imageSrc,
        datePublished: article.date,
        author: { '@type': 'Organization', name: article.author },
        publisher: { '@type': 'Organization', name: 'Elegant Sip' },
        articleSection: article.category,
      }
      : null,
  )

  if (!article) {
    return (
      <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6 text-center">
        <h1 className="text-3xl font-bold mb-4">Article not found</h1>
        <Link to="/journal" className="text-xs font-mono tracking-widest uppercase text-[#8bb56e] hover:text-[#1b261b] transition-colors">
          ← Back to the Journal
        </Link>
      </div>
    )
  }

  const others = JOURNAL.filter((a) => a.id !== article.id).slice(0, 2)

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-3xl mx-auto">
        <Link to="/journal" className="text-xs font-mono tracking-widest uppercase text-[#4a584a] hover:text-[#8bb56e] transition-colors mb-8 inline-block">
          ← Back to the Journal
        </Link>

        <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-4">{article.category}</span>
        <h1 className="text-3xl md:text-5xl font-bold uppercase tracking-tight leading-[1.1] mb-6">{article.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-[#4a584a]/70 uppercase tracking-wider mb-10">
          <span>{article.author}</span>
          <span className="w-1 h-1 rounded-full bg-[#8bb56e]" />
          <span>{article.date}</span>
          <span className="w-1 h-1 rounded-full bg-[#8bb56e]" />
          <span>{article.readTime}</span>
        </div>

        <img src={article.imageSrc} alt={article.imageAlt} className="w-full h-auto object-cover rounded-2xl border border-[#1b261b]/10 mb-10" />

        <div className="space-y-6 text-sm md:text-base text-[#4a584a] leading-relaxed">
          {article.body.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        {others.length > 0 && (
          <div className="mt-20 border-t border-[#1b261b]/10 pt-12">
            <h2 className="text-lg font-bold uppercase tracking-wide mb-8">Keep Reading</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {others.map((a) => (
                <Link key={a.id} to={`/journal/${a.id}`} className="group bg-white border border-[#1b261b]/10 rounded-2xl overflow-hidden transition-all hover:shadow-[0_12px_30px_rgba(27,38,27,0.06)] hover:-translate-y-1">
                  <img src={a.imageSrc} alt={a.imageAlt} loading="lazy" className="w-full aspect-[16/9] object-cover" />
                  <div className="p-5">
                    <span className="text-[10px] font-mono tracking-widest uppercase text-[#8bb56e]">{a.category}</span>
                    <h3 className="font-bold text-sm mt-2 group-hover:text-[#8bb56e] transition-colors">{a.title}</h3>
                    <p className="text-[11px] text-[#4a584a]/70 mt-2">{a.readTime}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function JournalPage() {
  useDocumentMeta(
    'The Journal  Elegant Sip',
    'Stories from the gardens, brewing guides, and the craft behind single-origin tea.',
  )

  const categories = ['All', ...Array.from(new Set(JOURNAL.map((a) => a.category)))]
  const [category, setCategory] = useState('All')
  const articles = category === 'All' ? JOURNAL : JOURNAL.filter((a) => a.category === category)

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto">
        <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-4">The Journal</span>
        <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tight leading-[1.05] mb-6">
          <BlurText as="span" inline text="Notes from " delay={120} />
          <BlurText as="span" inline text="the Garden" delay={120} className="text-[#8bb56e]" />
        </h1>
        <p className="text-[#4a584a] text-sm md:text-base max-w-2xl leading-relaxed mb-10">
          Craft, sourcing, and the ritual of brewing  written by the people who buy, taste, and pack every lot.
        </p>

        {/* Category filter */}
        <div className="flex flex-wrap gap-3 mb-12">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`text-xs font-bold tracking-wide py-2 px-5 rounded-full border transition-colors cursor-pointer ${category === c
                  ? 'bg-[#1b261b] border-[#1b261b] text-white'
                  : 'bg-white border-[#1b261b]/10 text-[#1b261b] hover:border-[#8bb56e] hover:text-[#8bb56e]'
                }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {articles.map((article) => (
            <Link key={article.id} to={`/journal/${article.id}`} className="group bg-white border border-[#1b261b]/10 rounded-2xl overflow-hidden transition-all hover:shadow-[0_12px_30px_rgba(27,38,27,0.06)] hover:-translate-y-1 flex flex-col">
              <div className="overflow-hidden">
                <img src={article.imageSrc} alt={article.imageAlt} loading="lazy" className="w-full aspect-[16/9] object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <div className="flex items-center gap-3 text-[10px] font-mono text-[#4a584a]/70 uppercase tracking-wider mb-3">
                  <span className="text-[#8bb56e]">{article.category}</span>
                  <span className="w-1 h-1 rounded-full bg-[#8bb56e]/40" />
                  <span>{article.readTime}</span>
                </div>
                <h2 className="font-bold text-lg tracking-tight leading-snug mb-3 group-hover:text-[#8bb56e] transition-colors">{article.title}</h2>
                <p className="text-xs text-[#4a584a] leading-relaxed flex-grow">{article.excerpt}</p>
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#8bb56e] mt-5">Read →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
