# Gera as duas versões do editor: a de teste (com amostra) e a do site.
# O módulo de música (teste) é inserido nos marcadores; para remover o teste, pare de usar esses marcadores.
import re, sys
S='/tmp/claude-0/-home-claude/ffb10055-633f-5d9a-bab7-1239a0ba7684/scratchpad/'
src=open(S+'poster.src.html',encoding='utf-8').read()
ui=open(S+'musica-teste/music-test.html',encoding='utf-8').read()
js=open(S+'musica-teste/music-test.js',encoding='utf-8').read()
assert src.count('<!-- @@MUSIC_UI@@ -->')==1 and src.count('/*@@MUSIC_JS@@*/')==1
full=src.replace('<!-- @@MUSIC_UI@@ -->',ui.rstrip()+'\n').replace('/*@@MUSIC_JS@@*/',js)
sample=open(S+'sample.b64').read().strip()
open(S+'poster-ascii.html','w',encoding='utf-8').write(full.replace('__SAMPLE__',sample))
old=open(S+'site/index.html',encoding='utf-8').read()
head=old[:old.index('<title>')]
body=full.split('\n',1)[1].replace('__SAMPLE__',sample)
open(S+'site/index.html','w',encoding='utf-8').write(head+'<title>Saô ASCII</title>\n<style>body{margin:0}</style>\n'+body)
for name,text in (('check',full),):
    open(S+'work/check_music.js','w').write(re.search(r'<script>([\s\S]*?)</script>',text).group(1))
print('built')
