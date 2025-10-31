// Simple fuzzy search utility for atlas search bar
// Returns an array of {item, score} sorted by best match (lowest score)
export function fuzzySearch(query, items, getLabel) {
    if (!query) return [];
    query = query.toLowerCase();
    const results = [];
    for (const item of items) {
        const label = getLabel(item).toLowerCase();
        const score = levenshtein(query, label);
        if (label.includes(query) || score <= Math.max(2, Math.floor(query.length/3))) {
            results.push({item, score});
        }
    }
    results.sort((a, b) => a.score - b.score);
    return results;
}

// Levenshtein distance (edit distance)
function levenshtein(a, b) {
    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1, // deletion
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return matrix[a.length][b.length];
}
