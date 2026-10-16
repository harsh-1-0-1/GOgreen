#!/usr/bin/env python3
"""Replace old variants section UI with new flexible variant groups UI."""

NEW_SECTION = '''              <div className="p-5 border-t border-gray-100 space-y-5 bg-white">
                <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-xs text-green-800 leading-relaxed">
                  <strong>How variants work:</strong> Click &ldquo;+ Add Variant Type&rdquo;, type a label (e.g. &ldquo;Select Size&rdquo;, &ldquo;Select Packet Size&rdquo;), then add options with name, price, and stock. Admin controls all labels — no category rules.
                </div>

                {variantError && (
                  <div className="rounded-lg bg-red-50 border border-red-100 p-3 flex gap-2 text-xs text-red-800">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>{variantError}</span>
                  </div>
                )}

                {/* Dynamic Variant Groups */}
                <div className="space-y-3">
                  {variantGroups.map((group) => (
                    <div key={group.id} className="rounded-xl border border-gray-200 bg-gray-50/40 overflow-hidden">
                      {/* Group header: label + remove */}
                      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                        <input
                          value={group.label}
                          onChange={(e) => {
                            const v = e.target.value;
                            setVariantGroups(prev => prev.map(g => g.id === group.id ? { ...g, label: v } : g));
                          }}
                          placeholder='Variant label shown to customer (e.g. "Select Size", "Select Packet Size", "Select Colour")'
                          className={`${inputClass} flex-1 bg-white font-medium`}
                        />
                        <button
                          type="button"
                          onClick={() => setVariantGroups(prev => prev.filter(g => g.id !== group.id))}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition shrink-0"
                          aria-label="Remove variant type"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Options */}
                      <div className="px-3 pb-3 space-y-2">
                        {group.options.map((opt) => (
                          <div key={opt.id} className="rounded-lg border border-gray-200 bg-white p-2.5">
                            <div className="flex gap-2 items-center flex-wrap">
                              {/* Image thumbnail */}
                              <div className="h-10 w-10 rounded border overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                                {opt.image_url
                                  ? <img src={opt.image_url} alt={opt.name || 'option'} className="h-full w-full object-cover" />
                                  : <ImageIcon size={14} className="text-gray-300" />}
                              </div>
                              {/* Name */}
                              <input
                                value={opt.name}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                    ...g, options: g.options.map(o => o.id !== opt.id ? o : { ...o, name: v }),
                                  }));
                                }}
                                placeholder='Name (e.g. "4 Inch", "100 gm", "Terracotta")'
                                className={`${inputClass} flex-1 min-w-32`}
                              />
                              {/* Price */}
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-xs text-gray-500">₹</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={opt.price}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                      ...g, options: g.options.map(o => o.id !== opt.id ? o : { ...o, price: v }),
                                    }));
                                  }}
                                  placeholder="Price"
                                  className="w-24 px-2 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                              {/* Stock */}
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-xs text-gray-500">Qty</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={opt.stock}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                      ...g, options: g.options.map(o => o.id !== opt.id ? o : { ...o, stock: v }),
                                    }));
                                  }}
                                  placeholder="Stock"
                                  className="w-20 px-2 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                              {/* Image upload */}
                              <label
                                className={`inline-flex items-center gap-1 px-2 py-2 rounded-lg border bg-gray-50 text-[11px] font-medium text-primary cursor-pointer hover:bg-green-50 shrink-0 ${uploadingOptionImage === opt.id ? 'opacity-60 pointer-events-none' : ''}`}
                                title="Upload option image"
                              >
                                {uploadingOptionImage === opt.id
                                  ? <Loader2 size={12} className="animate-spin" />
                                  : <Upload size={12} />}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  onChange={(e) => { void handleOptionImageUpload(group.id, opt.id, e.target.files?.[0]); e.target.value = ''; }}
                                />
                              </label>
                              {/* Remove option */}
                              <button
                                type="button"
                                onClick={() => setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                  ...g, options: g.options.filter(o => o.id !== opt.id),
                                }))}
                                disabled={group.options.length <= 1}
                                className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition shrink-0 disabled:opacity-30"
                                aria-label="Remove option"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            {opt.image_key && (
                              <button
                                type="button"
                                onClick={() => setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                  ...g, options: g.options.map(o => o.id !== opt.id ? o : { ...o, image_key: '', image_url: '' }),
                                }))}
                                className="text-[10px] text-red-500 hover:text-red-600 font-medium mt-1.5 block"
                              >
                                Remove image
                              </button>
                            )}
                          </div>
                        ))}

                        {/* Add Option */}
                        <button
                          type="button"
                          onClick={() => setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                            ...g, options: [...g.options, emptyOption()],
                          }))}
                          className="w-full py-1.5 border border-dashed border-primary/30 rounded-lg text-xs text-primary font-medium hover:bg-green-50/50 hover:border-primary/50 transition"
                        >
                          + Add Option
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Variant Type */}
                <button
                  type="button"
                  onClick={() => setVariantGroups(prev => [...prev, emptyGroup()])}
                  className="w-full py-2.5 border-2 border-dashed border-primary/25 rounded-xl text-sm font-semibold text-primary hover:bg-green-50/50 hover:border-primary/50 transition flex items-center justify-center gap-2"
                >
                  <Plus size={15} />
                  Add Variant Type
                </button>

                {/* Default Fallback Image */}
                <div className="border-t pt-4 space-y-2">
                  <label className="text-xs font-semibold text-gray-700 block">Default Variant Image</label>
                  <p className="text-[10px] text-gray-400">Fallback shown if a selected option has no image of its own.</p>
                  <div className="flex gap-3 items-center">
                    <div className="h-16 w-16 rounded-lg border overflow-hidden bg-white shrink-0 flex items-center justify-center">
                      {defaultImageUrl
                        ? <img src={defaultImageUrl} alt="Default" className="h-full w-full object-cover" />
                        : <ImageIcon size={22} className="text-gray-300" />}
                    </div>
                    <div className="flex-1">
                      <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-white text-xs font-medium text-primary cursor-pointer hover:bg-green-50 w-full justify-center ${uploadingDefaultImage ? 'opacity-60 pointer-events-none' : ''}`}>
                        <Upload size={14} />
                        {uploadingDefaultImage ? 'Uploading\u2026' : defaultImageKey ? 'Change default image' : 'Upload default image'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => { void handleDefaultImageUpload(e.target.files?.[0]); e.target.value = ''; }}
                        />
                      </label>
                      {defaultImageKey && (
                        <button type="button" onClick={() => { setDefaultImageKey(''); setDefaultImageUrl(''); }}
                          className="text-xs text-red-500 hover:text-red-600 mt-1 font-medium">
                          Remove image
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 6: SEO & Visibility */}'''

with open('src/pages/admin/ProductsAdminPage.tsx', 'r') as f:
    content = f.read()

old_start = '              <div className="p-5 border-t border-gray-100 space-y-5 bg-white">\n                <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-xs text-green-800 leading-relaxed">\n                  <strong>How variants work:</strong> Add different colors'
old_end = '          {/* Section 6: SEO & Visibility */}'

start_idx = content.find(old_start)
end_idx = content.find(old_end)

if start_idx == -1 or end_idx == -1:
    print("MARKERS NOT FOUND")
    exit(1)

new_content = content[:start_idx] + NEW_SECTION + content[end_idx + len(old_end):]

with open('src/pages/admin/ProductsAdminPage.tsx', 'w') as f:
    f.write(new_content)

print(f"Done. Replaced {end_idx - start_idx} chars with {len(NEW_SECTION)} chars.")
