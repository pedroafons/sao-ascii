# Teste: música e sincronização

Recurso experimental. Fica separado do editor para ser fácil de manter ou remover.

- `music-test.html`: os controles (bloco "Música teste", na aba Efeitos).
- `music-test.js`: análise da música e ligação com o editor, pelos ganchos `MUS_HOOK`.
- `build.py`: monta o editor inserindo esses dois arquivos nos marcadores
  `<!-- @@MUSIC_UI@@ -->` e `/*@@MUSIC_JS@@*/` do `poster.src.html`.

Como funciona: ao adicionar uma música, ela é analisada inteira (60 quadros por segundo):
energia em 8 faixas de frequência (graves à esquerda, agudos à direita) e pulso da batida.
Com a sincronização ligada, o ASCII varia os caracteres, ganha ondas sonoras e pulsa na batida.
A gravação de vídeo também inclui o áudio da música.

Para remover o teste: apague esta pasta, o bloco de marcação do HTML e a linha `/*@@MUSIC_JS@@*/`.
