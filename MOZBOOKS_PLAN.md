# Arquitetura e Telas do Projeto: MozBooks

Este documento detalha o planejamento completo da plataforma digital **MozBooks**, cobrindo a arquitetura técnica e o design do fluxo de telas.

---

## 1. Arquitetura do Projeto

O MozBooks foi planejado para ser rápido, seguro, escalável e de baixo custo inicial.

### Frontend (Interface do Usuário)
*   **Tecnologias:** React.js com TypeScript e Vite.
*   **Estilização:** Tailwind CSS utilizando o tema "Sophisticated Dark" (fundo escuro, detalhes em dourado para transmitir sofisticação e conforto ocular durante a leitura).
*   **Hospedagem:** Google Cloud Run (ou Firebase Hosting) para distribuição global rápida via CDN.

### Backend & Autenticação
*   **Serviço Restrito (Sem Servidor Próprio):** Utilizaremos o **Firebase** (Backend-as-a-Service) para não termos que manter servidores tradicionais.
*   **Autenticação:** Firebase Auth, configurado exclusivamente com **Login com o Google** para um cadastro rápido, seguro e sem fricção.

### Banco de Dados
*   **Tecnologia:** Cloud Firestore (NoSQL, em tempo real).
*   **Coleções Planejadas:** `users` (dados do perfil), `categories` (categorias fixas), `books` (catálogo de livros), `favorites` (livros salvos), `reading_history` (progresso) e `downloads` (estatísticas).

### Armazenamento de Arquivos (Livros e Capas)
*   **Tecnologia:** Firebase Cloud Storage ou Google Cloud Storage.
*   **Como Funciona:** Arquivos pesados (PDFs dos livros e imagens de capa em alta resolução) não ficam no banco de dados. Eles são salvos no Storage e o banco de dados guarda apenas o link (URL) seguro para acessá-los.

### Segurança
*   **Acesso a Arquivos (Storage Rules):** PDFs só podem ser visualizados ou baixados por usuários com e-mail verificado (logados).
*   **Segurança de Dados (Firestore Rules):** O histórico de leitura e os favoritos de um usuário são privados; um usuário só pode alterar seus próprios registros. Administradores podem adicionar, alterar ou excluir metadados de livros.

### Monetização Futura
*   **Google AdSense/AdMob:** Os espaços publicitários já estão reservados visualmente no design das telas em posições não invasivas (ex: na barra lateral, e banners no final das sinopses).

---

## 2. Fluxo de Telas (Design Atual)

O aplicativo já está estruturado com as seguintes telas interativas:

### 1. Tela Inicial (Home)
A porta de entrada. Possui um design moderno com destaque para o conteúdo central.
*   **Header:** Barra de navegação com logotipo, barra de pesquisa global e atalho de login.
*   **Grade de Livros:** Mostra os livros disponíveis, acompanhados da arte da capa, título, autor e avaliação. Passar o mouse exibe o botão rápido de favoritar.

### 2. Navegação de Categorias (Sidebar)
Em computadores, é uma barra lateral dedicada; no telemóvel (mobile), aparece via menu hambúrguer.
*   Permite filtrar o conteúdo central exibindo opções como: Todos os Livros, Estudantis, Romance, História, Motivacionais e Religiosos.

### 3. Tela de Pesquisa
Integrada diretamente no header (cabeçalho).
*   O usuário digita um nome (ex: "Biologia" ou "Maria Silva" o autor) e a grade de livros na página inicial é instantaneamente filtrada para mostrar os resultados relevantes.

### 4. Tela de Detalhes do Livro
Abre ao clicar na capa de um livro.
*   **Destaque:** Apresenta a capa em evidência na esquerda ou no topo.
*   **Informações:** Exibe a categoria em dourado, Título, Autor, número de avaliações.
*   **Ações:** Três grandes botões: **Ler Online (PDF)**, **Download** e **Favoritar** cruzando a tela.
*   **Sinopse:** O resumo descritivo do livro para o usuário ler antes de começar.
*   **AdSense:** Contém um espaço reservado abaixo da sinopse para banners publicitários de rentabilização.

### 5. Tela de Leitura
Ambiente livre de distrações ativado ao clicar em "Ler Online".
*   **Interface Limpa:** Esconde barras laterais para maximizar o tamanho do texto.
*   **Cabeçalho Simples:** Um botão minimalista de "Voltar" e o nome do livro no topo.
*   **Espaço de Leitura:** Fundo claro (imitação de papel de leitor digital, preservando uma moldura ao redor) para exibir o conteúdo do livro selecionado em páginas amigáveis.

### 6. Tela de Favoritos
Acessada através do link "Meus Favoritos" na secção superior da Navegação de Categorias.
*   **Biblioteca Pessoal:** Lista exclusivamente os livros que o usuário selecionou, servindo como uma "estante de salvar para depois".
*   **Estado Vazio:** Se não houver favoritos, exibe um ícone e orienta o usuário a explorar o catálogo para adicionar histórias.

### 7. Perfil e Login
Acessada através do botão "Entrar" no topo da página.
*   **Para usuários não logados:** Exibe uma interface super direta para conexão, focada num grande botão "Continuar com o Google" utilizando a estética visual do Google.
*   **Propósito:** Explica porquê o registro é importante (salvar progresso, fazer downloads offline e guardar favoritos). Funciona como tela central de configurações de utilizador.

Esta estrutura já está refletida no código fonte da aplicação que foi desenvolvida nesta sessão.
