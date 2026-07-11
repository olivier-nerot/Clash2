#!/usr/bin/env bash
# Normalise la casse des extensions média en minuscules.
# Indispensable sur le Pi (ext4 sensible à la casse) : le code référence des
# chemins en .mp4/.mp3 alors que certains fichiers source sont en .MP4/.MP3
# (transparent sur macOS insensible à la casse, mais 404 sur Linux).
#
# Usage : bash pi/normalize-media.sh [dossier_public]
set -e

PUBLIC="${1:-$(dirname "$0")/../public}"

normalize_dir() {
	local dir="$1"
	[ -d "$dir" ] || return 0
	shopt -s nullglob
	for f in "$dir"/*; do
		local base ext lower target
		base="$(basename "$f")"
		ext="${base##*.}"
		lower="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"
		if [ "$ext" != "$lower" ]; then
			target="$dir/${base%.*}.$lower"
			if [ -e "$target" ]; then
				echo "  ! conflit, ignoré : $base (existe déjà $target)"
			else
				mv -v "$f" "$target"
			fi
		fi
	done
}

echo "Normalisation de la casse des extensions dans $PUBLIC …"
normalize_dir "$PUBLIC/movies"
normalize_dir "$PUBLIC/music"
echo "Terminé."
