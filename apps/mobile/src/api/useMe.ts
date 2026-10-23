import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe } from "./me";

export const ME_QUERY_KEY = ["me"] as const;

export function useMe() {
  return useQuery({ queryKey: ME_QUERY_KEY, queryFn: fetchMe });
}

export function useInvalidateMe() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
}
