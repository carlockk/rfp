'use client';

import { memo } from 'react';

const newId = (prefix = 'node') =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Math.random().toString(16).slice(2)}`);

const DEFAULT_OPTIONS = [
  { key: 'cumple', label: 'Cumple' },
  { key: 'no-cumple', label: 'No cumple' },
  { key: 'no-aplica', label: 'No aplica' }
];

const ensureOptions = (node) => {
  if (node.inputType !== 'select') return undefined;
  if (Array.isArray(node.options) && node.options.length) return node.options;
  return DEFAULT_OPTIONS;
};

const updateNode = (nodes, path, updater) => {
  if (path.length === 0) return nodes;
  const [index, ...rest] = path;
  return nodes.map((node, idx) => {
    if (idx !== index) return node;
    if (rest.length === 0) {
      return updater(node);
    }
    return {
      ...node,
      children: updateNode(node.children || [], rest, updater)
    };
  });
};

const removeNode = (nodes, path) => {
  if (path.length === 0) return nodes;
  if (path.length === 1) {
    const [index] = path;
    return nodes.filter((_, idx) => idx !== index);
  }
  const [index, ...rest] = path;
  return nodes.map((node, idx) => {
    if (idx !== index) return node;
    return {
      ...node,
      children: removeNode(node.children || [], rest)
    };
  });
};

const addChild = (nodes, path, newNode) => {
  if (path.length === 0) {
    return [...nodes, newNode];
  }
  const [index, ...rest] = path;
  return nodes.map((node, idx) => {
    if (idx !== index) return node;
    if (rest.length === 0) {
      return {
        ...node,
        children: [...(node.children || []), newNode]
      };
    }
    return {
      ...node,
      children: addChild(node.children || [], rest, newNode)
    };
  });
};

const getNodeAtPath = (nodes, path) => {
  let currentNodes = nodes;
  let current = null;
  for (const index of path) {
    current = currentNodes?.[index];
    if (!current) return null;
    currentNodes = current.children || [];
  }
  return current;
};

const insertNodeAfter = (nodes, path, newNode) => {
  if (path.length === 0) return nodes;
  if (path.length === 1) {
    const [index] = path;
    const next = [...nodes];
    next.splice(index + 1, 0, newNode);
    return next;
  }
  const [index, ...rest] = path;
  return nodes.map((node, idx) => {
    if (idx !== index) return node;
    return {
      ...node,
      children: insertNodeAfter(node.children || [], rest, newNode)
    };
  });
};

const duplicateNode = (node) => {
  const clone = {
    ...node,
    key: newId('node'),
    title: `${node.title} (copia)`,
    options: node.options
      ? node.options.map((opt, idx) => ({
          ...opt,
          key: `${node.key || 'node'}-copy-${idx}`
        }))
      : undefined,
    children: node.children ? node.children.map(duplicateNode) : []
  };
  return clone;
};

function NodeEditor({
  node,
  path,
  onChangeNode,
  onAddChild,
  onRemoveNode,
  onDuplicateNode
}) {
  const options = ensureOptions(node);
  const isSection = node.inputType === 'section';
  const showOptions = node.inputType === 'select';

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        background: 'var(--surface)'
      }}
    >
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label className="label">Título</label>
          <input
            className="input"
            value={node.title}
            onChange={(event) =>
              onChangeNode(path, { ...node, title: event.target.value })
            }
            required
          />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label className="label">Tipo</label>
          <select
            className="input"
            value={node.inputType}
            onChange={(event) => {
              const nextType = event.target.value;
              onChangeNode(path, {
                ...node,
                inputType: nextType,
                options: nextType === 'select' ? ensureOptions({ ...node, inputType: nextType }) : undefined
              });
            }}
          >
            <option value="section">Sección</option>
            <option value="select">Selección</option>
            <option value="text">Texto corto</option>
            <option value="textarea">Texto largo</option>
            <option value="number">Número</option>
            <option value="checkbox">Check</option>
          </select>
        </div>
        {!isSection ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label className="label" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={node.required}
                onChange={(event) =>
                  onChangeNode(path, { ...node, required: event.target.checked })
                }
              />{' '}
              Requerido
            </label>
            {(node.inputType === 'select' || node.inputType === 'checkbox') ? (
              <label className="label" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={node.allowMultiple}
                  onChange={(event) =>
                    onChangeNode(path, {
                      ...node,
                      allowMultiple: event.target.checked
                    })
                  }
                />{' '}
                Múltiples
              </label>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 12 }}>
        <label className="label">Descripción</label>
        <textarea
          className="input"
          rows={2}
          value={node.description}
          onChange={(event) =>
            onChangeNode(path, { ...node, description: event.target.value })
          }
        />
      </div>

      {showOptions ? (
        <div style={{ marginTop: 12 }}>
          <label className="label">Opciones</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {options?.map((option, index) => (
              <div key={option.key} style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={option.label}
                  onChange={(event) => {
                    const nextOptions = options.map((opt, idx) =>
                      idx === index ? { ...opt, label: event.target.value } : opt
                    );
                    onChangeNode(path, { ...node, options: nextOptions });
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const nextOptions = options.filter((_, idx) => idx !== index);
                    onChangeNode(path, { ...node, options: nextOptions });
                  }}
                  disabled={options.length <= 1}
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn"
              onClick={() =>
                onChangeNode(path, {
                  ...node,
                  options: [
                    ...(options || []),
                    {
                      key: `${node.key}-option-${(options || []).length}`,
                      label: 'Nueva opción'
                    }
                  ]
                })
              }
            >
              Añadir opción
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          className="btn"
          onClick={() =>
            onAddChild(path, {
              key: newId('node'),
              title: isSection ? 'Nuevo ítem' : 'Sub ítem',
              description: '',
              inputType: 'select',
              required: false,
              allowMultiple: false,
              options: DEFAULT_OPTIONS,
              children: []
            })
          }
        >
          Añadir sub ítem
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => onDuplicateNode(path)}
        >
          Duplicar
        </button>
        <button type="button" className="btn" onClick={() => onRemoveNode(path)}>
          Eliminar
        </button>
      </div>

      {node.children && node.children.length ? (
        <div style={{ borderLeft: '2px solid var(--border)', marginTop: 16, paddingLeft: 16 }}>
          {node.children.map((child, index) => (
            <MemoNodeEditor
              key={child.key}
              node={child}
              path={[...path, index]}
              onChangeNode={onChangeNode}
              onAddChild={onAddChild}
              onRemoveNode={onRemoveNode}
              onDuplicateNode={onDuplicateNode}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const MemoNodeEditor = memo(NodeEditor);

export default function ChecklistBuilder({ value, onChange }) {
  const handleNodeChange = (path, nextNode) => {
    const normalized = {
      ...nextNode,
      options: ensureOptions(nextNode)
    };
    onChange(updateNode(value, path, () => normalized));
  };

  const handleAddChild = (path, newNode) => {
    onChange(addChild(value, path, newNode));
  };

  const handleRemove = (path) => {
    onChange(removeNode(value, path));
  };

  const handleDuplicate = (path) => {
    const source = getNodeAtPath(value, path);
    if (!source) return;
    const clone = duplicateNode(source);
    onChange(insertNodeAfter(value, path, clone));
  };

  return (
    <div>
      {value.map((node, index) => (
        <MemoNodeEditor
          key={node.key || index}
          node={node}
          path={[index]}
          onChangeNode={handleNodeChange}
          onAddChild={handleAddChild}
          onRemoveNode={handleRemove}
          onDuplicateNode={handleDuplicate}
        />
      ))}
      <button
        type="button"
        className="btn"
        onClick={() =>
          onChange([
            ...value,
            {
              key: newId('section'),
              title: `Sección ${value.length + 1}`,
              description: '',
              inputType: 'section',
              required: false,
              allowMultiple: false,
              options: undefined,
              children: []
            }
          ])
        }
      >
        Añadir sección
      </button>
    </div>
  );
}
