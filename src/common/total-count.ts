/** tipo estructural de la response para exponer el header X-Total-Count */
export type totalCountHeader = {
  setHeader: (name: string, value: number) => void;
};

/** publica el total efectivo del listado sin tipar con express */
export const setTotalCount = (res: totalCountHeader, total: number) => {
  res.setHeader('X-Total-Count', total);
};
