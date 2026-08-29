import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchManifest, updateProduct } from '../api/client';
import { Spinner } from '../components';
import { useUIStore } from '../stores/uiStore';

export default function ManifestReview() {
  const { id } = useParams<{ id: string }>();
  const merchantId = Number(id);
  const { addToast } = useUIStore();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<{ productId: number; field: string; value: any } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['manifest', merchantId],
    queryFn: () => fetchManifest(merchantId),
  });

  const updateMut = useMutation({
    mutationFn: ({ productId, data }: { productId: number; data: any }) => updateProduct(productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manifest', merchantId] });
      addToast('Product updated', 'success');
      setEditingField(null);
    },
  });

  if (isLoading) return <Spinner />;
  const manifest = data?.manifest;
  const products = data?.products || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-fadeIn">
      {/* Header */}


      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-text-secondary mb-1">
            <Link to="/" className="hover:text-primary transition-colors">Merchants</Link>
            <span>/</span>
            <span>Manifest Review</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text">Product Manifest</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs sm:text-sm">
          <span className="text-text-secondary">
            {manifest?.normalized_product_count} products · {manifest?.flagged_count} flagged
          </span>
          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full font-medium text-xs">
            {manifest?.completeness_score?.toFixed(0)}% complete
          </span>
        </div>
      </div>

      {/* Product Table with Responsive Horizontal Scroll */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-surface-alt">
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Product</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Price</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Stock</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Category</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Delivery</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((p: any) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  editingField={editingField}
                  setEditingField={setEditingField}
                  onSave={(field: string, value: any) => updateMut.mutate({
                    productId: p.id,
                    data: { [field]: value },
                  })}
                  onApprove={() => updateMut.mutate({
                    productId: p.id,
                    data: { needs_verification: false },
                  })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProductRow({ product, expanded, onToggle, editingField, setEditingField, onSave, onApprove }: any) {
  const p = product;
  const confidence = p.confidence_flags || {};

  const renderField = (field: string, value: any, conf?: number) => {
    const isEditing = editingField?.productId === p.id && editingField?.field === field;
    const isLowConf = conf !== undefined && conf < 0.7;

    if (isEditing) {
      return (
        <input
          autoFocus
          defaultValue={value}
          onBlur={(e) => onSave(field, field === 'price' || field === 'stock' || field === 'delivery_days' ? Number(e.target.value) : e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave(field, field === 'price' || field === 'stock' || field === 'delivery_days' ? Number((e.target as HTMLInputElement).value) : (e.target as HTMLInputElement).value);
            if (e.key === 'Escape') setEditingField(null);
          }}
          className="px-2 py-1 border border-primary rounded text-sm w-full focus:outline-none focus:ring-1 focus:ring-primary"
        />
      );
    }

    return (
      <span
        onClick={() => setEditingField({ productId: p.id, field, value })}
        className={`cursor-pointer hover:bg-primary/5 px-1 rounded ${isLowConf ? 'bg-warning/10 border-b-2 border-warning' : ''}`}
        title={conf !== undefined ? `Confidence: ${(conf * 100).toFixed(0)}%` : undefined}
      >
        {value}
      </span>
    );
  };

  return (
    <>
      <tr className={`hover:bg-surface-alt/50 ${p.needs_verification ? 'bg-warning/5' : ''}`}>
        <td className="px-6 py-4">
          <button onClick={onToggle} className="flex items-center gap-2">
            <svg className={`w-4 h-4 text-text-secondary transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium text-sm text-text">{renderField('name', p.name, confidence.name)}</span>
          </button>
        </td>
        <td className="px-6 py-4 text-sm">{renderField('price', `₹${p.price}`, confidence.price)}</td>
        <td className="px-6 py-4 text-sm">{renderField('stock', p.stock, confidence.stock)}</td>
        <td className="px-6 py-4 text-sm">{renderField('category', p.category, confidence.category)}</td>
        <td className="px-6 py-4 text-sm">{renderField('delivery_days', `${p.delivery_days}d`, confidence.delivery_days)}</td>
        <td className="px-6 py-4">
          {p.needs_verification ? (
            <span className="px-2 py-0.5 bg-warning/10 text-warning text-xs font-medium rounded">Needs Review</span>
          ) : (
            <span className="px-2 py-0.5 bg-success/10 text-success text-xs font-medium rounded">Verified</span>
          )}
        </td>
        <td className="px-6 py-4">
          {p.needs_verification && (
            <button onClick={onApprove} className="text-xs text-primary font-medium hover:underline">Approve</button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-6 py-4 bg-surface-alt/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-text-secondary">Return Policy:</span>
                <span className="ml-1 text-text">{p.return_policy}</span>
              </div>
              <div>
                <span className="text-text-secondary">Variants:</span>
                <span className="ml-1 text-text">{JSON.stringify(p.variants)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Raw Text:</span>
                <span className="ml-1 text-text font-mono">{p.raw_text?.slice(0, 100)}</span>
              </div>
              <div>
                <span className="text-text-secondary">Confidence:</span>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {Object.entries(confidence).map(([k, v]: [string, any]) => (
                    <span key={k} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      v >= 0.7 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                    }`}>
                      {k}: {(v * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
