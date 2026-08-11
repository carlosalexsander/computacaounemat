#!/usr/bin/env bash
cd ~/dev/sites/computacaounemat.github.io

echo "=== Branch atual e commits ==="
git branch
git log --oneline -5

echo ""
echo "=== O que mudou nessa branch vs main ==="
git diff main..atualiza-horarios-2026-2 --stat

echo ""
echo "=== PDFs ainda na raiz? (deveriam ter sido removidos) ==="
ls -la *.pdf 2>/dev/null || echo "(nenhum PDF solto)"

echo ""
echo "=== Status do PR ==="
gh pr list --repo computacaounemat/computacaounemat.github.io
gh pr view --repo computacaounemat/computacaounemat.github.io atualiza-horarios-2026-2 2>&1 || true
