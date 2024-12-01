import { pipeline, cos_sim } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

async function loadEmbeddingsToDB() {
    // Fetch and parse the JSON file
    const response = await fetch('/assets/document_embeddings.json');
    const data = await response.json();

    // Store in IndexedDB using Dexie.js
    await db.embeddings.bulkPut(
        data.map(item => ({
            docId: item.doc_id,
            embedding: item.embedding,
        }))
    );

    // Cache the count of embeddings
    embeddingCount = data.length;

    console.log(`${embeddingCount} Embeddings successfully stored in IndexedDB`);
}


let embeddingPipeline, db;
let embeddingCount = 0; // Global variable to cache the count


async function setup() {
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
    db = new Dexie('EmbeddingsDatabase');
    db.version(1).stores({
        embeddings: 'docId, embedding' // Index by docId
    });

    // Load embeddings in the background
    await loadEmbeddingsToDB().then(() => {
        console.log('Embeddings loaded successfully');
    }).catch((err) => {
        console.error('Failed to load embeddings:', err);
    });
}

export async function search() {
    console.log('in search')
    try {
        const query = document.getElementById('search-box').value.trim();
        if (!query) {
            alert('Please enter a query!');
            return;
        }

        // Step 2: Tokenize and embed the query
        const queryEmbedding = await embeddingPipeline([query], {pooling: 'mean', 'normalize': true});
        
        // Step 3: Initialize variables for finding the best matches
        const topDocs = [];
        const topN = embeddingCount;
        // const topN = 5;
        console.log(`topN=${topN}`);

        // Step 4: Iterate over stored embeddings
        await db.embeddings.each((storedEmbedding) => {
            // console.log('searching ... ')
            const { docId, embedding } = storedEmbedding;
            // console.log(docId)
            // console.log('doc', embedding)
            // console.log('query', queryEmbedding.data)
            // Compute similarity
            const similarity = cos_sim(embedding, queryEmbedding.data);
            // console.log('similarity:')
            // console.log(similarity)

            // Add to the top docs if it qualifies
            if (topDocs.length < topN) {
                topDocs.push({ docId, similarity });
                topDocs.sort((a, b) => b.similarity - a.similarity);
            } else if (similarity > topDocs[topDocs.length - 1].similarity) {
                topDocs[topDocs.length - 1] = { docId, similarity };
                topDocs.sort((a, b) => b.similarity - a.similarity);
            }
        });

        // // Step 5: Display results
        // const resultsDiv = document.getElementById('results');
        // resultsDiv.innerHTML = topDocs
        //     .map(doc => `<p><strong>${doc.docId}</strong>: ${doc.similarity.toFixed(2)}</p>`)
        //     .join('');
        
        // const dots = d3.selectAll("circle");
        // // Dim all dots initially
        // dots.classed("dimmed", true);

        // // Highlight only the dots that match the search results
        // const relevantSlugs = new Set(topDocs.map(doc => doc.docId));
        // console.log(relevantSlugs);
        // dots.filter(function() {
        //     console.log(this.getAttribute("data-slug"));
        //     // Check if the current circle's data-slug attribute is in the relevantSlugs set
        //     return relevantSlugs.has(this.getAttribute("data-slug"));
        // }).classed("dimmed", false);
        // if (topDocs.length === 0) {
        //     dots.classed("dimmed", false);
        // }

        // Normalize the similarity scores for opacity scaling
        const minSimilarity = Math.min(...topDocs.map(doc => doc.similarity));
        const maxSimilarity = Math.max(...topDocs.map(doc => doc.similarity));

        // Update the opacity of the dots based on similarity scores
        const dots = d3.selectAll("circle");
        dots.each(function () {
            const slug = this.getAttribute("data-slug");
            const matchingDoc = topDocs.find(doc => doc.docId === slug);

            if (matchingDoc) {
                // Scale similarity to opacity range (10% to 100%)
                const normalizedSimilarity = (matchingDoc.similarity - minSimilarity) / (maxSimilarity - minSimilarity);
                const opacity = 0.1 + normalizedSimilarity * 0.9; // Scale between 0.1 and 1.0
                d3.select(this).style("opacity", opacity);
            } else {
                // Dim dots that are not in the search results
                d3.select(this).style("opacity", 0.1);
            }
        });
        if (topDocs.length === 0) {
            dots.style("opacity", 1.0);
        }
        
    
    } catch (error) {
        console.error('Search failed:', error);
    }
}

// Debounce function to limit how often search is triggered
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Example of clearing the dimming effect when search is cleared
async function clearSearch() {
    d3.selectAll("circle").classed("dimmed", false).style("opacity", 1.0);
}

// Attach event listener to the input field
document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("search-box");
    if (searchInput) {
        searchInput.addEventListener("input", debounce(async (event) => {
            const query = event.target.value.trim();
            if (query.length > 0) {
                await search(query);
            } else {
                await clearSearch(); // Clear the dimming effect if the query is empty
            }
        }, 300)); // Adjust debounce time as needed
    }
});

(async () => {
    await setup();
})();