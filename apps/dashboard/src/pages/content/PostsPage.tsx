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
    meta: { success: "Blog post updated." },
    mutationFn: ({ id, path }: { id: number; path: string }) => api(`/blogs/${id}/${path}`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  const remove = useMutation({
    meta: { success: "Blog post permanently deleted." },
    mutationFn: (id: number) => api(`/blogs/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  const columns: Column<Post>[] = [
    {
      key: "title",
      header: "Post title",
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
    { key: "type", header: "Kind of post", className: "text-muted-foreground", cell: (p) => p.postType.replace("_", " ").toLowerCase() },
    { key: "category", header: "Category", className: "text-muted-foreground", cell: (p) => p.blogCategory?.name ?? "No category chosen" },
    { key: "author", header: "Written by", className: "text-muted-foreground", cell: (p) => p.writer?.name ?? "No author chosen" },
    { key: "views", header: "Website page views", align: "right", className: "text-muted-foreground", cell: (p) => p.views },
    {
      key: "status",
      header: "Visible to the public?",
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
                  { label: "Restore this post from the trash", icon: RotateCcw, onSelect: () => patch.mutate({ id: post.id, path: "restore" }) },
                  {
                    label: "Delete this post forever",
                    icon: Trash2,
                    variant: "destructive",
                    separatorBefore: true,
                    onSelect: () =>
                      confirmDialog({ title: "Delete this post forever?", description: "The post will be erased completely and cannot be brought back. If you might want it later, leave it in the trash instead.", confirmLabel: "Yes, delete it forever", cancelLabel: "No, leave it in the trash" }, () => remove.mutate(post.id)),
                  },
                ]
              : [
                  { label: "Open this post to edit it", icon: PenLine, onSelect: () => navigate(`/posts/${post.id}`) },
                  { label: "Move this post to the trash", icon: Trash2, separatorBefore: true, onSelect: () => patch.mutate({ id: post.id, path: "trash" }) },
                ]
          }
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Blog posts"
        description="Articles and travel guides published on your website's blog. Good posts help travellers find you on Google. Create a new post, or open an existing one to edit, publish or hide it. Deleted posts wait in the trash first."
        action={
          <Button asChild>
            <Link to="/posts/new">
              <Plus />
              Write a new post
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
        searchPlaceholder="Search posts by title…"
        emptyIcon={Newspaper}
        emptyTitle={trashed ? "The trash is empty" : "You have not written any blog posts yet"}
        emptyHint={trashed ? undefined : "Select “Write a new post” to create your first article. A post can be a travel guide, a trip report, news, or tips for travellers."}
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={published}
              onValueChange={(v) => {
                setPublished(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-52" aria-label="Filter posts by whether they are published">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All posts</SelectItem>
                <SelectItem value="true">Published on website</SelectItem>
                <SelectItem value="false">Hidden drafts</SelectItem>
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
              {trashed ? "Showing the trash. Click to go back to posts" : "Show deleted posts (trash)"}
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
