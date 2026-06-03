interface Props {
  children: React.ReactNode;
  width?: 'default' | 'narrow';
  className?: string;
}

export default function PageContainer({ children, width = 'default', className = '' }: Props) {
  const maxW = width === 'narrow' ? 'max-w-3xl' : 'max-w-7xl';
  return (
    <div className={`${maxW} mx-auto w-full px-4 sm:px-6 lg:px-8${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
