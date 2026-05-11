# Checklist de Publicação do MozBooks

Este documento serve como um guia abrangente para preparar, otimizar e lançar o MozBooks nas plataformas web e mobile.

## 1. Otimização de Performance 🚀
- [ ] **Code Splitting (React.lazy):** Componentes grandes ou rotas que não são da home page foram divididas para menor Time-to-Interactive.
- [ ] **Otimização de Imagens:** As capas dos livros e imagens de perfil estão usando dimensões adequadas e formatos otimizados (WebP ou AVIF).
- [ ] **Framer Motion Ajustes:** Todas as animações na mudança de tela (`currentView`) terminam harmoniosamente sem encavalar.
- [ ] **Cache do Firebase:** `onSnapshot` está funcionando em cache, minimizando as chamadas ao banco de dados no Frontend.
- [ ] **Service Worker e PWA (Feito ✅):** O `vite-plugin-pwa` está configurado no `vite.config.ts`, suportando offline caching base. Falta gerar os ícones finais (favicon, logo192, logo512) na pasta `/public`.

## 2. Testes Finais e Correção de Bugs 🐛
- [ ] Testar todos os fluxos de Autenticação (Login, Registro, Resetar Senha).
- [ ] Pular rápido pelas categorias e garantir que as animações acompanham sem bugar o layout.
- [ ] Testar a busca avançada por autor, idioma e classe escolar.
- [ ] Checar "Continue Lendo" logado - Garantir que ao abrir um livro o progresso é salvo localmente.
- [ ] Moderação de Conteúdo do Admin: Somente o administrador (configurado no firestore.rules) consegue enviar/apagar livros.

## 3. Segurança e Regras do Firebase 🔐
- [ ] O arquivo `firestore.rules` foi revisto para proteger a leitura/escrita não autorizada (Testes PII e Spoofing blindados).
- [ ] Nenhuma credencial/Service Account "Hard-coded" no sistema. Tudo via variáveis de ambiente seguras (no AI Studio, isso é controlado pela engine).
- [ ] Autenticação com Email e Google confirmadas via `popup`. E-mails de verificação estão ativados (boa prática).
- [ ] Proteção anti-DDoS e Rate Limiting (Opcional - Configurado via cota do GCP).

## 4. Transformação em Aplicativo (Web App & APK) 📱
Como o MozBooks foi transformado num Progressive Web App (PWA):
### A. Versão Web Final (Produção Directa)
1. Certifique-se de que não haja erros de build ou de dependências (`npm run build`).
2. O sistema do Google AI Studio providencia uma hospedagem em container (Cloud Run); também pode importar para a Vercel, Firebase Hosting, Netlify, fazendo:
   `npm run build && firebase deploy`

### B. Versão APK (Android)
Uma vez que é PWA, o modelo mais estável para lojas como a Play Store, é encapsular em TWA (Trusted Web Activity). Para tal:
1. Você precisa hospedar o App (Como no passo acima, garanta que está com certificado SSL/HTTPS).
2. Use a ferramenta oficial do Google: **PWABuilder** (https://pwabuilder.com/)
3. Cole a URL pública final do MozBooks na ferramenta.
4. O PWABuilder validará as métricas do Android e WebManifest (que já configuramos).
5. Exporte a pasta gerada (.aab ou .apk). E ela pode ser direto indexada à Google Play Console.
*(Alternativamente: A biblioteca `bubblewrap` do Chrome Labs pode construir o app localmente se tiver o Android SDK).*

## 5. Práticas de Loja e Lançamento 🛒
- [ ] **Políticas de Privacidade:** Crie uma página ou PDF nos buckets documentando Termos de Serviço e Política de Privacidade (obrigatório para Google Play Store).
- [ ] **Capturas de Tela e Vídeo:** Separe as imagens atraentes para a submissão (A Home da Netflix/Kindle estilo premium atrai ótimos cliques).
- [ ] **Metadata:** Use descrições longas contendo palavras-chaves: Livros educacionais de Moçambique, Literatura gratuita, PDF, Leitura.

**Parabéns! O MozBooks está projetado de forma robusta, bonita e moderna para escalar aos céus. 🌟**
