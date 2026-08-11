#!/usr/bin/env bash
set -euo pipefail
cd ~/dev/sites/computacaounemat.github.io

git checkout main
git pull origin main
git checkout -b atualiza-horarios-2026-2

claude -p "Os arquivos Datas_AIA.pdf e Datas_ROO.pdf (na raiz deste repositório) contêm o horário de aulas 2026/2 da Ciência da Computação, campus Alto Araguaia e Rondonópolis respectivamente (professor, disciplina, dias da semana, datas por mês). Encontre onde o horário de aulas é exibido neste site (HTML e/ou os arquivos assets/files/Horario.AIA.zip e Horario.ROO.zip) e atualize com os dados desses dois PDFs, preservando o estilo e a estrutura HTML/CSS já existentes no site. Se houver uma tabela de horário desatualizada, substitua pelo conteúdo correto dos PDFs. Também atualize os arquivos para download (zips) para refletirem os PDFs novos, da forma que fizer mais sentido dado como o site já está estruturado. No final, apague os dois PDFs da raiz do repositório (não devem ficar soltos lá) e me dê um resumo do que foi alterado." \
  --allowedTools "Read,Write,Edit,Bash"

echo ""
echo "=== Diff ==="
git status
git diff --stat

echo ""
echo "=== Commit e envio via fork ==="
git add -A
git commit -m "Atualiza horario de aulas 2026/2 (Alto Araguaia e Rondonopolis)"
git push fork atualiza-horarios-2026-2

gh pr create --repo computacaounemat/computacaounemat.github.io \
  --head carlosalexsander:atualiza-horarios-2026-2 \
  --base main \
  --title "Atualiza horario de aulas 2026/2" \
  --body "Atualiza o horario de aulas do 2026/2 para Alto Araguaia e Rondonopolis com base nos horarios oficiais mais recentes."
