import { Children, Fragment, cloneElement, isValidElement } from 'react';

const flatten = children => Children.toArray(children).flatMap(child =>
  isValidElement(child) && child.type === Fragment ? flatten(child.props.children) : [child]);

const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : isValidElement(node) ? Children.toArray(node.props.children).map(text).join('') : '';

// One set of records/actions: table on desktop, labelled record cards on phones.
export default function ResponsiveTable({ children, className = '', mobileCards = true, ...props }) {
  const sections = flatten(children);
  const header = sections.find(section => isValidElement(section) && section.type === 'thead');
  const headerRow = header && Children.toArray(header.props.children).find(row => isValidElement(row) && row.type === 'tr');
  const labels = headerRow ? flatten(headerRow.props.children).map(text) : [];
  const transformed = sections.map(section => {
    if (!isValidElement(section) || !['thead', 'tbody', 'tfoot'].includes(section.type)) return section;
    return cloneElement(section, { role: 'rowgroup' }, Children.map(section.props.children, row => {
      if (!isValidElement(row) || row.type !== 'tr') return row;
      return cloneElement(row, { role: 'row' }, flatten(row.props.children).map((cell, index) => {
        if (!isValidElement(cell) || !['td', 'th'].includes(cell.type)) return cell;
        const label = labels[index] || '';
        return cloneElement(cell, cell.type === 'th' ? { key: index, role: 'columnheader', scope: 'col' } : {
          key: index,
          role: 'cell', 'data-label': label,
          'data-wide': /action|history|members|allocated to|reminders/i.test(label) ? 'true' : undefined,
        });
      }));
    }));
  });
  return <div className={`responsive-table-wrap${mobileCards ? '' : ' keep-table-rows'}`}><table {...props} role="table" className={`${mobileCards ? 'responsive-records' : 'row-records'} ${className}`.trim()}>{transformed}</table></div>;
}
