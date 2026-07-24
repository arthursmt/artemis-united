#!/usr/bin/env bash
# Carrega o .env de um pacote e roda um comando dentro dele, num único passo
# não encadeado — evita "cd <dir> && set -a && source .env && set +a && <cmd>"
# inline (ver memory: feedback_shell_command_patterns).
#
# Uso: scripts/with-env.sh <diretorio-do-pacote> <comando...>
# Ex.:  scripts/with-env.sh apps/api npm run dev
#       scripts/with-env.sh services/bob-engine npx drizzle-kit migrate
set -euo pipefail

pkg_dir="$1"
shift

if [ ! -f "$pkg_dir/.env" ]; then
  echo "with-env.sh: $pkg_dir/.env não existe" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$pkg_dir/.env"
set +a

cd "$pkg_dir"
exec "$@"
