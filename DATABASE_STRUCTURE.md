# Estrutura do Banco de Dados - MozBooks

Abaixo está o modelo arquitetural de dados planejado para a plataforma digital MozBooks. Esse modelo usa a abordagem de coleções e documentos (ideal para bancos de dados modernos, como Firebase/Firestore ou MongoDB), mas também pode ser facilmente adaptado para tabelas relacionais em SQL (PostgreSQL, MySQL).

## 1. Coleção: `users` (Usuários)
Armazena as informações das contas dos usuários registrados (pelo Google Auth).
*   `id` (String, PK): Identificador único do usuário.
*   `name` (String): Nome completo do usuário.
*   `email` (String): E-mail da conta Google.
*   `avatarUrl` (String): Link para a foto de perfil.
*   `role` (String): Nível de acesso (ex: `user` para leitores normais, `admin` para administradores que podem adicionar livros).
*   `createdAt` (Timestamp): Data e hora em que a conta foi criada.

## 2. Coleção: `categories` (Categorias)
Armazena a lista de categorias que organizam os livros da plataforma.
*   `id` (String, PK): Identificador único (ex: 'historia').
*   `name` (String): Nome amigável de exibição (ex: 'Livros de História').
*   `description` (String): Uma breve descrição da categoria (opcional).

## 3. Coleção: `books` (Livros)
Armazena o catálogo principal de livros da biblioteca digital.
*   `id` (String, PK): Identificador único do livro.
*   `title` (String): Título oficial do livro.
*   `author` (String): Nome do autor principal do livro.
*   `description` (String): Resumo ou sinopse.
*   `coverUrl` (String): Link para a imagem (storage) de capa do livro.
*   `pdfUrl` (String): Link para o arquivo (storage) do livro completo em PDF.
*   `categoryId` (String, FK): ID referenciando a qual categoria o livro pertence.
*   `rating` (Number): Pontuação média das avaliações do livro (ex: 4.5).
*   `pages` (Number): Número total de páginas (útil para calcular o progresso).
*   `createdAt` (Timestamp): Quando o livro foi publicado na plataforma.

## 4. Coleção: `favorites` (Favoritos)
Relaciona os usuários aos livros que eles marcaram como favoritos.
*(Nota: Para um site simples, isso também poderia ser um array de `bookIds` dentro do documento do Usuário, mas criar uma coleção separada ajuda na escalabilidade e permite futuras queries complexas).*
*   `id` (String, PK): Identificador único do registro do favorito.
*   `userId` (String, FK): ID do usuário.
*   `bookId` (String, FK): ID do livro favoritado.
*   `addedAt` (Timestamp): Data em que foi adicionado aos favoritos.

## 5. Coleção: `reading_history` (Histórico de Leitura)
Acompanha o progresso atual do usuário na leitura do livro.
*   `id` (String, PK): Identificador da sessão de leitura.
*   `userId` (String, FK): ID do usuário leitor.
*   `bookId` (String, FK): ID do livro que está sendo lido.
*   `lastPageRead` (Number): O número da última página lida pelo usuário.
*   `progressPercentage` (Number): Cálculo em % do quanto já foi lido (ex: 35%).
*   `lastReadAt` (Timestamp): A última vez que o usuário abriu este livro para leitura.

## 6. Coleção: `downloads` (Histórico de Downloads)
Para métricas da plataforma, é super importante registrar os downloads para saber quais livros são mais populares offline.
*   `id` (String, PK): Identificador do registro de download.
*   `userId` (String, FK): ID do usuário (pode ser nulo caso o sistema de downloads se torne global e não exija login).
*   `bookId` (String, FK): ID do livro baixado.
*   `downloadedAt` (Timestamp): Quando ocorreu o download.

---

## Escalonabilidade e Segurança
*   **Armazenamento de Arquivos:** As capas (JPEG/PNG) e os PDFs devem ficar num serviço chamado de *Object Storage*, como **Amazon S3** ou **Firebase Cloud Storage**. Ao invés de salvar o arquivo pesado no banco de dados, você armazena o link dele na coleção `books`.
*   **Regras de Segurança de Acesso:** Usuários não logados têm nível restrito (podem ver `books` e `categories`, mas não alterar nada). Os registros que dependem do usuário (favoritos, histórico e downloads do usuário) têm regras para que a conta Y não veja os dados da conta X.
*   **Escalabilidade (Indexação):** Recomenda-se criar índices no campo `categoryId` para acelerar a busca de livros por categoria, bem como no campo `userId` nas tabelas relacionadas, para o carregamento do Perfil ocorrer quase instaneamente.
