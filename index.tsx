import { CATEGORIES, COLORS, ALL_PARTS } from './data.js';

// --- DATA ---
// Data is now imported from data.js

const COLOR_MAP = COLORS.reduce((acc, color) => {
  acc[color.id] = color;
  return acc;
}, {});

const PART_MAP = ALL_PARTS.reduce((acc, part) => {
  acc[part.id] = part;
  return acc;
}, {});

// --- ICONS ---
const CatalogIcon = (className) => `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;
const CollectionIcon = (className) => `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polygon points="2 17 12 22 22 17"></polygon><polygon points="2 12 12 17 22 12"></polygon></svg>`;
const FolderIcon = (className) => `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"></path></svg>`;
const PlusIcon = (className) => `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
const MinusIcon = (className) => `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
const XIcon = (className) => `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const MenuIcon = (className) => `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;

// --- TYPES ---
type Collection = {
    [partId: string]: {
        [colorId: string]: number;
    };
};

interface State {
    currentView: 'catalog' | 'collection';
    selectedCategory: string;
    searchQuery: string;
    selectedPartId: string | null;
    isSidebarOpen: boolean;
    modal: {
        selectedColorId: string | null;
        quantity: number;
    };
    collection: Collection;
}


// --- STATE MANAGEMENT ---
let state: State = {
  currentView: 'catalog', // 'catalog' or 'collection'
  selectedCategory: 'all',
  searchQuery: '',
  selectedPartId: null,
  isSidebarOpen: window.innerWidth >= 1024,
  modal: {
      selectedColorId: null,
      quantity: 1,
  },
  collection: {}, // { 'partId': { 'colorId': quantity } }
};

function loadState() {
  const savedCollection = localStorage.getItem('legoCollection');
  if (savedCollection) {
    try {
      const parsed = JSON.parse(savedCollection);
      if (typeof parsed === 'object' && parsed !== null) {
        state.collection = parsed as Collection;
      } else {
        state.collection = {};
      }
    } catch (e) {
      console.error("Failed to parse lego collection from localStorage", e);
      state.collection = {};
    }
  }
}

function saveState() {
  localStorage.setItem('legoCollection', JSON.stringify(state.collection));
}

// --- DOM Elements ---
const sidebarContainer = document.getElementById('sidebar-container');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const headerContainer = document.getElementById('header-container');
const mainContent = document.getElementById('main-content');
const modalContainer = document.getElementById('modal-container');

// --- RENDER FUNCTIONS ---
function getPartImageUrl(partId: string, colorId: string) {
    const color = COLOR_MAP[colorId];
    const displayColorId = color?.isTransparent ? '13' : '6';
    const url1 = `https://img.bricklink.com/ItemImage/PN/${displayColorId}/${partId}.png`;
    const url2 = `https://img.bricklink.com/P/${displayColorId}/${partId}.gif`;
    return `src="${url1}" onerror="this.onerror=null; this.src='${url2}';"`;
}

function renderSidebar() {
  const { uniqueModelsCount, totalPartsCount } = Object.keys(state.collection).reduce((acc, partId) => {
    acc.uniqueModelsCount += Object.keys(state.collection[partId]).length;
    acc.totalPartsCount += Object.values(state.collection[partId]).reduce((sum, q) => sum + q, 0);
    return acc;
  }, { uniqueModelsCount: 0, totalPartsCount: 0 });

  const viewButtonStyle = (view: 'catalog' | 'collection') => `w-1/2 flex items-center justify-center px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-150 ${state.currentView === view ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`;

  sidebarContainer.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-shrink-0">
      <h1 class="text-xl font-bold text-white">Меню</h1>
      <button id="sidebar-close" class="lg:hidden text-gray-400 hover:text-white p-1">
        ${XIcon('w-6 h-6')}
      </button>
    </div>

    <div class="flex bg-gray-900/70 rounded-lg p-1 mb-4 flex-shrink-0">
      <button data-view="catalog" class="${viewButtonStyle('catalog')}">${CatalogIcon('w-5 h-5 mr-2')} Каталог</button>
      <button data-view="collection" class="${viewButtonStyle('collection')}">${CollectionIcon('w-5 h-5 mr-2')} Коллекция</button>
    </div>
    
    <div class="flex-grow overflow-y-auto no-scrollbar">
      <h2 class="text-lg font-semibold text-white mb-4">Категории</h2>
      <nav>
        <ul id="category-list">
          ${CATEGORIES.map(cat => `
            <li class="mb-2">
              <button data-category-id="${cat.id}" class="w-full text-left flex items-center px-3 py-2 rounded-md transition-colors duration-150 ${state.selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}">
                ${FolderIcon('w-5 h-5 mr-3')}
                <span>${cat.name}</span>
              </button>
            </li>
          `).join('')}
        </ul>
      </nav>
    </div>
    
    <div class="flex-shrink-0 mt-4 border-t border-gray-700 pt-4">
        <h2 class="text-lg font-semibold text-white mb-2">Сводка коллекции</h2>
        ${totalPartsCount === 0 ? '<p class="text-gray-400 text-sm">Ваша коллекция пуста.</p>' : `
          <div class="space-y-2 text-sm">
              <div class="flex justify-between"><span class="text-gray-400">Уникальные модели:</span><span class="font-bold text-white">${uniqueModelsCount}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">Всего деталей:</span><span class="font-bold text-white">${totalPartsCount}</span></div>
          </div>
        `}
    </div>
  `;
}

function renderHeader() {
    headerContainer.innerHTML = `
        <div class="flex justify-between items-center">
            <div class="flex items-center">
                <button id="sidebar-toggle" class="lg:hidden text-gray-300 hover:text-white mr-4 -ml-1 p-1">
                    ${MenuIcon('w-6 h-6')}
                </button>
                <h1 class="text-xl font-bold text-white hidden sm:block">LEGO® Part Catalog</h1>
            </div>
            <div class="relative w-full max-w-[150px] sm:max-w-xs">
                <input id="search-input" type="text" placeholder="Поиск..." value="${state.searchQuery}" class="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
        </div>
    `;
}

function renderPartCard(part, color, quantity) {
    return `
        <div data-part-id="${part.id}" class="part-card relative bg-gray-800 rounded-lg overflow-hidden cursor-pointer group transform transition-all duration-300 hover:scale-105 hover:bg-gray-700">
            ${quantity > 0 ? `<div class="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10 shadow-md">${quantity}</div>` : ''}
            <div class="w-full h-40 bg-gray-700 flex items-center justify-center p-4 pointer-events-none">
                <img ${getPartImageUrl(part.id, color.id)} alt="${part.name}" class="w-full h-full object-contain" loading="lazy" />
            </div>
            <div class="p-4 pointer-events-none">
                <h3 class="text-sm font-semibold text-white truncate">${part.name}</h3>
                <p class="text-xs text-gray-400">ID: ${part.id}</p>
            </div>
        </div>
    `;
}

function renderGrid() {
    let content = '';
    if (state.currentView === 'catalog') {
        const parts = ALL_PARTS.filter(part => {
            const catMatch = state.selectedCategory === 'all' || part.categoryId === state.selectedCategory;
            const searchMatch = state.searchQuery.trim() === '' || 
                part.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                part.id.toLowerCase().includes(state.searchQuery.toLowerCase());
            return catMatch && searchMatch;
        });

        if (parts.length === 0) {
            content = `<div class="flex items-center justify-center h-full p-4 text-center"><p class="text-gray-400">Детали не найдены в каталоге. Попробуйте другой поиск или категорию.</p></div>`;
        } else {
            const defaultColor = COLOR_MAP['6'] || COLOR_MAP['11'];
            content = `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 p-4">
                ${parts.map(p => renderPartCard(p, defaultColor, 0)).join('')}
            </div>`;
        }
    } else { // Collection view
        const items = [];
        for (const partId in state.collection) {
          for (const colorId in state.collection[partId]) {
            const part = PART_MAP[partId];
            const color = COLOR_MAP[colorId];
            const quantity = state.collection[partId][colorId];
            if (part && color && quantity > 0) {
              items.push({ part, color, quantity });
            }
          }
        }
        
        const filteredItems = items.filter(({ part }) => {
            const catMatch = state.selectedCategory === 'all' || part.categoryId === state.selectedCategory;
            const searchMatch = state.searchQuery.trim() === '' ||
                part.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                part.id.toLowerCase().includes(state.searchQuery.toLowerCase());
            return catMatch && searchMatch;
        }).sort((a,b) => a.part.name.localeCompare(b.part.name));

        if (filteredItems.length === 0) {
            content = `<div class="flex items-center justify-center h-full p-4 text-center"><p class="text-gray-400">В вашей коллекции нет деталей, соответствующих фильтру.<br/>Попробуйте изменить поиск или категорию.</p></div>`;
        } else {
            content = `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 p-4">
                ${filteredItems.map(item => renderPartCard(item.part, item.color, item.quantity)).join('')}
            </div>`;
        }
    }
    mainContent.innerHTML = content;
}

function renderModal() {
    if (!state.selectedPartId) {
        modalContainer.classList.add('modal-hidden');
        document.body.classList.remove('overflow-hidden');
        modalContainer.innerHTML = '';
        return;
    }

    const part = PART_MAP[state.selectedPartId];
    if (!part) {
        state.selectedPartId = null; // Reset if part not found
        updateUI();
        return;
    }

    const { selectedColorId, quantity } = state.modal;
    const selectedColor = selectedColorId ? COLOR_MAP[selectedColorId] : null;
    const currentInCollection = (selectedColorId && state.collection[part.id]?.[selectedColorId]) || 0;
    
    document.body.classList.add('overflow-hidden');
    modalContainer.innerHTML = `
    <div id="modal-content" class="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4 flex flex-col md:flex-row relative">
        <button id="modal-close" class="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10">${XIcon('w-6 h-6')}</button>
        
        <div class="md:w-1/2 p-6 bg-gray-700/50 rounded-l-lg flex items-center justify-center">
            ${selectedColorId ? `<img ${getPartImageUrl(part.id, selectedColorId)} alt="${part.name}" class="max-w-full max-h-64 object-contain">` : ''}
        </div>
        
        <div class="md:w-1/2 p-6 flex flex-col">
            <h2 class="text-2xl font-bold text-white">${part.name}</h2>
            <p class="text-sm text-gray-400 mb-4">ID: ${part.id}</p>
            
            <div class="flex-grow">
                <h3 class="text-md font-semibold text-gray-300 mb-2">Доступные цвета</h3>
                <div id="color-selector" class="grid grid-cols-6 gap-2 mb-4">
                    ${part.availableColorIds.map(cid => {
                        const color = COLOR_MAP[cid];
                        if (!color) return '';
                        const isInCollection = state.collection[part.id]?.[cid] > 0;
                        return `
                            <button data-color-id="${cid}" title="${color.name}" class="w-10 h-10 rounded-full border-2 transition-transform duration-150 overflow-hidden ${color.isTransparent ? 'checkerboard' : ''} ${selectedColorId === cid ? 'border-blue-500 scale-110' : 'border-gray-600 hover:border-gray-400'}" style="background-color: ${color.hex};">
                                ${isInCollection ? '<div class="w-2 h-2 bg-white rounded-full m-auto"></div>' : ''}
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
            
            ${selectedColor ? `
                <div class="bg-gray-700/50 rounded-lg p-4 mt-auto">
                    <div class="grid grid-cols-2 gap-x-4 gap-y-3 items-center">
                        <!-- Row 1 -->
                        <p class="text-white font-semibold">${selectedColor.name}</p>
                        <p class="text-sm text-gray-400 text-right">В коллекции: <span class="font-bold text-white">${currentInCollection}</span></p>
                        
                        <!-- Row 2 -->
                        <div class="flex items-center gap-2">
                            <button data-action="decrease-qty" class="p-2 rounded-full bg-gray-600 hover:bg-gray-500 text-white transition-colors">${MinusIcon('w-5 h-5')}</button>
                            <input type="number" value="${quantity}" readonly class="w-12 text-center bg-gray-900 text-white font-bold rounded-md py-1"/>
                            <button data-action="increase-qty" class="p-2 rounded-full bg-gray-600 hover:bg-gray-500 text-white transition-colors">${PlusIcon('w-5 h-5')}</button>
                        </div>
                        <button data-action="update-collection" class="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                            ${currentInCollection > 0 ? 'Обновить' : 'Добавить'}
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
    </div>
    `;
    modalContainer.classList.remove('modal-hidden');
}

function updateUI() {
    // Core render functions
    renderSidebar();
    renderHeader();
    renderGrid();
    renderModal();

    // Sidebar visibility logic
    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
        if (state.isSidebarOpen) {
            sidebarContainer.classList.remove('-translate-x-full');
            sidebarBackdrop.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Prevent background scroll
        } else {
            sidebarContainer.classList.add('-translate-x-full');
            sidebarBackdrop.classList.add('hidden');
            document.body.style.overflow = '';
        }
    } else {
        // On desktop, sidebar is controlled by CSS media queries
        sidebarContainer.classList.remove('-translate-x-full'); // Ensure it's visible
        sidebarBackdrop.classList.add('hidden'); // Ensure backdrop is hidden
        document.body.style.overflow = '';
    }
}

// --- EVENT HANDLING ---
function handleUpdateCollection(partId, colorId, quantity) {
    if (!state.collection[partId]) {
        state.collection[partId] = {};
    }
    if (quantity > 0) {
        state.collection[partId][colorId] = quantity;
    } else {
        delete state.collection[partId][colorId];
        if (Object.keys(state.collection[partId]).length === 0) {
            delete state.collection[partId];
        }
    }
    saveState();
    updateUI();
}

document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) {
        return;
    }
    const target = e.target as HTMLElement;
    const isMobile = window.innerWidth < 1024;

    // --- Sidebar Toggles ---
    if (target.closest('#sidebar-toggle')) {
        state.isSidebarOpen = true;
        updateUI();
        return;
    }
    if (target.closest('#sidebar-close') || target.id === 'sidebar-backdrop') {
        state.isSidebarOpen = false;
        updateUI();
        return;
    }

    // --- Sidebar Nav Clicks ---
    const viewButton = target.closest<HTMLElement>('[data-view]');
    if (viewButton) {
        state.currentView = viewButton.dataset.view as 'catalog' | 'collection';
        if (isMobile) { state.isSidebarOpen = false; }
        updateUI();
        return;
    }
    const categoryButton = target.closest<HTMLElement>('[data-category-id]');
    if (categoryButton) {
        state.selectedCategory = categoryButton.dataset.categoryId;
        if (isMobile) { state.isSidebarOpen = false; }
        updateUI();
        return;
    }

    // --- Grid Card Click ---
    const partCard = target.closest<HTMLElement>('.part-card');
    if (partCard && mainContent.contains(partCard)) {
        state.selectedPartId = partCard.dataset.partId;
        const part = PART_MAP[state.selectedPartId];
        if (part) {
            state.modal.selectedColorId = part.availableColorIds[0] || null;
            const currentQuantity = state.collection[part.id]?.[state.modal.selectedColorId] || 0;
            state.modal.quantity = currentQuantity > 0 ? currentQuantity : 1;
        }
        updateUI();
        return;
    }
    
    // --- Modal Clicks ---
    if (target.id === 'modal-container' || target.closest('#modal-close')) {
        state.selectedPartId = null;
        updateUI();
        return;
    }

    const modalContent = document.getElementById('modal-content');
    if (modalContent && modalContent.contains(target)) {
         const colorButton = target.closest<HTMLElement>('[data-color-id]');
        if (colorButton) {
            state.modal.selectedColorId = colorButton.dataset.colorId;
            const currentQuantity = (state.collection[state.selectedPartId]?.[state.modal.selectedColorId]) || 0;
            state.modal.quantity = currentQuantity > 0 ? currentQuantity : 1;
            renderModal(); // Just re-render the modal, not the whole UI
            return;
        }

        const actionButton = target.closest<HTMLElement>('[data-action]');
        if (actionButton) {
            const action = actionButton.dataset.action;
            if (action === 'increase-qty') {
                state.modal.quantity++;
            } else if (action === 'decrease-qty') {
                state.modal.quantity = Math.max(0, state.modal.quantity - 1);
            } else if (action === 'update-collection' && state.modal.selectedColorId) {
                handleUpdateCollection(state.selectedPartId, state.modal.selectedColorId, state.modal.quantity);
                return; // handleUpdateCollection calls updateUI, so we exit
            }
            renderModal(); // Re-render modal for quantity changes
        }
    }
});

// --- Search Input ---
document.addEventListener('input', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.id === 'search-input') {
        state.searchQuery = e.target.value;
        renderGrid();
    }
});

document.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement && e.target.id === 'search-input' && e.key === 'Enter') {
        e.target.blur();
    }
});

// --- Window Resize Handler ---
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const isDesktop = window.innerWidth >= 1024;
        // On desktop, the sidebar should always be "open" (i.e., visible)
        // On mobile, its state is preserved.
        if (isDesktop) {
            state.isSidebarOpen = true;
        }
        updateUI();
    }, 100);
});

// --- INITIALIZATION ---
loadState();
updateUI();