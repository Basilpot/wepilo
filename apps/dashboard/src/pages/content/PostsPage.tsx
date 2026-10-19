import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, Plus, RotateCcw, Trash2, Newspaper } from "lucide-react";
import { api, type Paginated } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, RowActions, type Column } from "@/components/data-table";
import { confirmDialog } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Post = {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  inTrash: boolean;
  views: number;
  likes: number;
  postType: "BLOG" | "TRAVEL_GUIDE";
  publishedAt: string | number | null;
  blogCategory: { id: number; name: string | null } | null;
  writer: { id: number; name: string | null } | null;
};

export function PostsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [published, setPublished] = useState("all");
  const [trashed, setTrashed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["posts", page, limit, search, published, trashed],
    queryFn: () =>
      api<Paginated<Post>>("/blogs", {
        query: {
          page,
          limit,
          search: search || undefined,
          published: published === "all" ? undefined : published,
          trashed: trashed ? "true" : undefined,
        },
      }),
  });

  const patch = useMutation({
    meta: { success: "Updated" },
    mutationFn: ({ id, path }: { id: number; path: string }) => api(`/blogs/${id}/${path}`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  const remove = useMutation({
    meta: { success: "Deleted" },
    mutationFn: (id: number) => api(`/blogs/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  const columns: Column<Post>[] = [
    {
      key: "title",
      header: "Title",
      cell: (post) =>
        trashed ? (
          <span className="font-medium">{post.title}</span>
        ) : (
          <Link
            to={`/posts/${post.id}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {post.title}
          </Link>
        ),
    },
    { key: "type", header: "Type", className: "text-muted-foreground", cell: (p) => p.postType.replace("_", " ") },
    { key: "category", header: "Category", className: "text-muted-foreground", cell: (p) => p.blogCategory?.name ?? "—" },
    { key: "author", header: "Author", className: "text-muted-foreground", cell: (p) => p.writer?.name ?? "—" },
    { key: "views", header: "Views", align: "right", className: "text-muted-foreground", cell: (p) => p.views },
    {
      key: "status",
      header: "Status",
      cell: (p) => (
        <StatusBadge kind="content" status={p.published ? "published" : "draft"} />
      ),
    },
    {
      key: "actions",
      headClassName: "w-12",
      className: "text-right",
      cell: (post) => (
        <RowActions
          actions={
            trashed
              ? [
                  { label: "Restore", icon: RotateCcw, onSelect: () => patch.mutate({ id: post.id, path: "restore" }) },
                  {
                    label: "Delete forever",
                    icon: Trash2,
                    variant: "destructive",
                    separatorBefore: true,
                    onSelect: () =>
                      confirmDialog({ description: "Permanently delete this post?" }, () => remove.mutate(post.id)),
                  },
                ]
              : [
                  { label: "Edit post", icon: PenLine, onSelect: () => navigate(`/posts/${post.id}`) },
                  { label: "Trash", icon: Trash2, separatorBefore: true, onSelect: () => patch.mutate({ id: post.id, path: "trash" }) },
                ]
          }
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Posts"
        description="Blog posts and travel guides."
        action={
          <Button asChild>
            <Link to="/posts/new">
              <Plus />
              New post
            </Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(p) => p.id}
        isLoading={isLoading}
        onRowClick={trashed ? undefined : (p) => navigate(`/posts/${p.id}`)}
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
        }}
        searchPlaceholder="Search posts…"
        emptyIcon={Newspaper}
        emptyTitle={trashed ? "Trash is empty" : "No posts yet"}
        emptyHint={trashed ? undefined : "Write your first post to get started."}
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={published}
              onValueChange={(v) => {
                setPublished(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Published</SelectItem>
                <SelectItem value="false">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={trashed ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setTrashed(!trashed);
                setPage(1);
              }}
            >
              <Trash2 />
              {trashed ? "Showing trash" : "Trash"}
            </Button>
          </div>
        }
        pagination={
          data
            ? {
                page: data.pagination.page,
                totalPages: data.pagination.totalPages,
                total: data.pagination.total,
                limit,
                onPage: setPage,
                onLimit: (l) => {
                  setLimit(l);
                  setPage(1);
                },
              }
            : undefined
        }
      />
    </div>
  );
}
