import { useState, useEffect, useCallback, useRef } from 'react';
import { getProductsApi, deleteProductApi, getCategoriesApi, getBrandsApi } from '../../api/inventory.api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineBan, HiOutlineExclamation } from 'react-icons/hi';
import ProductFormModal from './ProductFormModal';

export default function ProductsPage() {
  const { isAdmin, isManager } = useAuth();
  const canWrite = isAdmin || isManager;

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const debounceRef = useRef(null);

  // Debounce search input — wait 400ms after typing stops
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchProducts = useCallback(async (page = 1) => {
    try {
      const params = { page, limit: 10, search: debouncedSearch };
      if (filterCategory) params.category_id = filterCategory;
      const res = await getProductsApi(params);
      setProducts(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load products');
    }
  }, [debouncedSearch, filterCategory]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    getCategoriesApi({ status: 'active' }).then((r) => setCategories(r.data.data.categories)).catch(() => {});
    getBrandsApi({ status: 'active' }).then((r) => setBrands(r.data.data.brands)).catch(() => {});
  }, []);

  function openCreate() {
    setEditingProduct(null);
    setShowModal(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setShowModal(true);
  }

  async function handleDeactivate(product) {
    try {
      await deleteProductApi(product.id);
      toast.success('Product deactivated');
      fetchProducts(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  }

  function onSaved() {
    setShowModal(false);
    fetchProducts(pagination.page);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">{pagination.total} products total</p>
        </div>
        {canWrite && (
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors">
            <HiOutlinePlus className="h-4 w-4" /> Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Brand</th>
                <th className="px-5 py-3 text-right">Buy Price</th>
                <th className="px-5 py-3 text-right">Sell Price</th>
                <th className="px-5 py-3 text-right">Stock</th>
                <th className="px-5 py-3">Status</th>
                {canWrite && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => {
                const lowStock = p.total_stock < p.min_stock_alert;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium">{p.name}</td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-500">{p.sku}</td>
                    <td className="px-5 py-4 text-gray-500">{p.category?.name || '-'}</td>
                    <td className="px-5 py-4 text-gray-500">{p.brand?.name || '-'}</td>
                    <td className="px-5 py-4 text-right tabular-nums">{Number(p.purchase_price).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-right tabular-nums">{Number(p.selling_price).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-right">
                      <span className={`inline-flex items-center gap-1 font-semibold ${lowStock ? 'text-red-600' : 'text-gray-900'}`}>
                        {lowStock && <HiOutlineExclamation className="h-4 w-4" />}
                        {p.total_stock}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        p.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>{p.status}</span>
                    </td>
                    {canWrite && (
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => openEdit(p)} className="mr-2 text-gray-400 hover:text-primary-600" title="Edit">
                          <HiOutlinePencil className="h-4 w-4" />
                        </button>
                        {p.status === 'active' && (
                          <button onClick={() => handleDeactivate(p)} className="text-gray-400 hover:text-red-600" title="Deactivate">
                            <HiOutlineBan className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr><td colSpan="9" className="px-5 py-8 text-center text-gray-400">No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => fetchProducts(i + 1)}
              className={`h-8 w-8 rounded-lg text-sm font-medium ${
                pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >{i + 1}</button>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          brands={brands}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
