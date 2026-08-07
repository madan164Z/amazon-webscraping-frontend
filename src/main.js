import { apiUrl } from './config.js';

const rankForm = document.getElementById('rank-form');
const rankKeywordInput = document.getElementById('rank-keyword-input');
const rankUrlInput = document.getElementById('rank-url-input');
const rankIdentifierError = document.getElementById('rank-identifier-error');
const rankSubmitButton = document.getElementById('rank-submit-button');
const rankLoader = document.getElementById('rank-loader');
const rankResultContainer = document.getElementById('rank-result-container');
const rankResultsInfoContainer = document.getElementById('rank-results-info-container');
const rankResultsContainer = document.getElementById('rank-results-container');

const CURRENCY_REGION_MAP = {
    US: '$',
    BR: 'R$',
    ES: '€',
    IN: '₹',
    PK: 'AED'
};

let activeRankController = null;
rankForm.addEventListener('submit', (e) => {
    e.preventDefault();
    fetchRank();
});

rankUrlInput.addEventListener('input', () => {
    if (rankUrlInput.value.trim()) {
        clearFormError(rankIdentifierError);
    }
});

async function fetchRank() {
    const keyword = rankKeywordInput.value.trim();
    const productUrl = rankUrlInput.value.trim();

    if (!keyword) {
        showFormError(rankKeywordInput, 'Please enter a search keyword.');
        return;
    }

    if (!productUrl) {
        showFormError(rankIdentifierError, 'Please paste the product\'s Amazon URL.');
        return;
    }

    if (!/^https?:\/\//i.test(productUrl)) {
        showFormError(rankIdentifierError, 'That doesn\'t look like a valid URL — it should start with https://');
        return;
    }

    clearFormError(rankIdentifierError);

    activeRankController?.abort();
    const controller = new AbortController();
    activeRankController = controller;

    rankLoader.classList.remove('hidden');
    rankSubmitButton.disabled = true;
    rankResultContainer.innerHTML = '';
    rankResultsInfoContainer.innerHTML = '';
    rankResultsContainer.innerHTML = '';

    try {
        const response = await fetch(apiUrl('/api/rank'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                keyword,
                product_url: productUrl,
                max_pages: 5
        
            })
        });

        const data = await parseJsonResponse(response);

        if (!response.ok) {
            throw new Error(describeApiError(response.status, data));
        }

        displayRankResult(data);
        displayResultsInfo(rankResultsInfoContainer, data.resultsInfo, data.totalProductsScanned);
        displayProductsInto(rankResultsContainer, data.allProducts, null);
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Rank lookup error:', error);
        rankResultContainer.innerHTML = `<p class="error-message">${escapeHtml(error.message)}</p>`;
    } finally {
        if (activeRankController === controller) {
            rankLoader.classList.add('hidden');
            rankSubmitButton.disabled = false;
            activeRankController = null;
        }
    }
}

function displayRankResult(data) {
    const card = document.createElement('div');

    if (!data.found) {
        if (data.scanIncomplete) {
            card.className = 'rank-result-card not-found incomplete';
            card.innerHTML = `
                <div class="rank-badge">?</div>
                <div class="rank-details">
                    <p><strong>Scan interrupted</strong> — Amazon blocked the request after page ${data.pagesScanned}.</p>
                    <p class="meta">${data.totalProductsScanned} products were checked before the block. This does not mean your product is unranked — please try again in a moment.</p>
                </div>
            `;
        } else {
            card.className = 'rank-result-card not-found';
            card.innerHTML = `
                <div class="rank-badge">—</div>
                <div class="rank-details">
                    <p><strong>Not found</strong> within the first ${data.pagesScanned} page(s) scanned.</p>
                    <p class="meta">${data.totalProductsScanned} products checked (organic + sponsored). Amazon's ranking can shift between requests — try again, or confirm the URL is correct.</p>
                </div>
            `;
        }
        rankResultContainer.appendChild(card);
        return;
    }

    const matchLabel = { asin: 'Matched by ASIN', url: 'Matched by URL' }[data.matchMethod] || '';
    const sponsoredNote = data.matchedProduct?.isSponsored
        ? ' <span class="sponsored-badge">Sponsored</span>'
        : '';

    card.className = 'rank-result-card found';
    card.innerHTML = `
        <div class="rank-badge">#${data.rank}</div>
        <div class="rank-details">
            <p><strong>${escapeHtml(data.matchedProduct?.title ?? '')}</strong>${sponsoredNote}</p>
            <p>Page ${data.page}, position ${data.positionOnPage} on that page.</p>
            <p><span class="match-method-badge">${matchLabel}</span></p>
            <p class="meta">${data.totalProductsScanned} products scanned across ${data.pagesScanned} page(s).</p>
        </div>
    `;
    rankResultContainer.appendChild(card);
}

function displayResultsInfo(container, resultsInfo, fallbackCount) {
    if (resultsInfo?.raw) {
        container.innerHTML = `<p class="results-info">${escapeHtml(resultsInfo.raw)}</p>`;
        return;
    }

    if (resultsInfo?.total != null) {
        const prefix = resultsInfo.totalIsEstimate ? 'over ' : '';
        container.innerHTML = `<p class="results-info">${prefix}${resultsInfo.total.toLocaleString()} results</p>`;
        return;
    }

    if (fallbackCount) {
        container.innerHTML = `<p class="results-info">${fallbackCount} result${fallbackCount === 1 ? '' : 's'} on this page</p>`;
        return;
    }

    container.innerHTML = '';
}

function displayProductsInto(container, products, fallbackRegion) {
    if (!products || products.length === 0) {
        container.innerHTML = '<p class="empty-message">No products found. Try another keyword.</p>';
        return;
    }

    container.innerHTML = '';

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';

        const region = product.region || fallbackRegion;
        const productPrice = product.price != null
            ? `${CURRENCY_REGION_MAP[region] || ''} ${product.price.toFixed(2)}`
            : 'Price not available';
        const productRating = product.ratingStars ? `⭐ ${product.ratingStars} / 5` : 'No rating';
        const productBsr = product.bestSellerRank ? `🏆 ${escapeHtml(product.bestSellerRank)}` : '';
        const sponsoredBadge = product.isSponsored ? '<span class="sponsored-badge">Sponsored</span>' : '';

        card.innerHTML = `
            <a href="${escapeHtml(product.productUrl ?? '#')}" target="_blank" rel="noopener noreferrer">
                <div class="image-container">
                    <img src="${escapeHtml(product.imageUrl ?? '')}" alt="${escapeHtml(product.title ?? '')}" loading="lazy">
                </div>
                <div class="info">
                    ${sponsoredBadge}
                    <h3 class="title">${escapeHtml(product.title ?? '')}</h3>
                    <div>
                        <p class="price">${productPrice}</p>
                        <p class="rating">${productRating}</p>
                        ${productBsr ? `<p class="bsr">${productBsr}</p>` : ''}
                    </div>
                </div>
            </a>
        `;
        container.appendChild(card);
    });
}

async function parseJsonResponse(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function describeApiError(status, data) {
    if (data?.details) return data.details;
    if (data?.error) return data.error;
    if (status === 502 || status === 504) {
        return 'The server had trouble reaching Amazon. This can happen if Amazon is rate-limiting requests — please try again in a moment.';
    }
    if (status === 429) {
        return 'Too many requests right now — please wait a moment and try again.';
    }
    if (status >= 500) {
        return 'Something went wrong on the server. Please try again.';
    }
    return `Request failed (status ${status}).`;
}

function showFormError(target, message) {
    const isErrorElement = target.classList?.contains('field-error');

    if (!isErrorElement) {
        target.classList?.add('input-error');
    }

    const errorEl = isErrorElement
        ? target
        : target.parentElement?.querySelector('.field-error');

    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    } else {
        // Fallback for inputs without a dedicated error slot in the DOM.
        alert(message);
    }
}

function clearFormError(container) {
    container.textContent = '';
    container.classList.add('hidden');
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}
