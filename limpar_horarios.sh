#!/usr/bin/env bash
set -euo pipefail
cd ~/dev/sites/computacaounemat.github.io

git rm --cached atualizar_horario.sh 2>/dev/null || true
rm -f atualizar_horario.sh diagnostico_horarios.sh

git add -A
git commit -m "Remove scripts de manutencao que entraram por engano"
git push fork atualiza-horarios-2026-2

echo ""
echo "=== PR ==="
gh pr view 3 --repo computacaounemat/computacaounemat.github.io
