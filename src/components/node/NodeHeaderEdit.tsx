'use client';

import { Pencil, Pin, Star, Trash2 } from 'lucide-react';
import * as React from 'react';

import { deleteNodeAction, saveNodeMeta, setPin } from '@/app/node/[id]/actions';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface NodeHeaderEditProps {
  nodeId: string;
  title: string | null;
  icon: string | null;
  body: string | null;
  childCount: number;
  parentLabel: string | null; // null = children would fall to top level / inbox
  pinned: 'favorite' | 'ongoing' | null;
}

/** Inline edit of title/icon/body + delete-with-confirm. Delete closes the
 *  gap: children re-parent one level up (triage.removeNode) — the confirm
 *  says so when the node is structural. */
export function NodeHeaderEdit(props: NodeHeaderEditProps) {
  const [editing, setEditing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  return (
    <>
      <span className="flex items-center gap-1">
        {/* B2 three-way pin: favorite (star) / ongoing (pin) / none — the two
            are mutually exclusive; tapping the active one clears it */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={props.pinned === 'favorite' ? 'remove from favorites' : 'add to favorites'}
          className={props.pinned === 'favorite' ? 'text-foreground' : 'text-muted-foreground'}
          onClick={() => setPin(props.nodeId, props.pinned === 'favorite' ? null : 'favorite')}
        >
          <Star
            className={`size-3.5 ${props.pinned === 'favorite' ? 'fill-current' : ''}`}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={props.pinned === 'ongoing' ? 'unpin ongoing' : 'pin as ongoing'}
          className={props.pinned === 'ongoing' ? 'text-foreground' : 'text-muted-foreground'}
          onClick={() => setPin(props.nodeId, props.pinned === 'ongoing' ? null : 'ongoing')}
        >
          <Pin className={`size-3.5 ${props.pinned === 'ongoing' ? 'fill-current' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="edit node"
          onClick={() => setEditing((v) => !v)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="delete node"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </span>

      {editing && (
        <form
          action={async (fd) => {
            await saveNodeMeta(props.nodeId, fd);
            setEditing(false);
          }}
          className="border-border mt-2 flex w-full flex-col gap-3 rounded-lg border p-3"
        >
          <div className="flex gap-2">
            <div className="flex w-16 flex-col gap-1.5">
              <Label htmlFor="icon">Icon</Label>
              <Input id="icon" name="icon" defaultValue={props.icon ?? ''} placeholder="🙂" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={props.title ?? ''} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="body">Body</Label>
            <Textarea id="body" name="body" rows={2} defaultValue={props.body ?? ''} />
          </div>
          <div className="flex gap-2">
            <SubmitButton size="sm">Save</SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{props.title ?? props.body ?? 'this node'}”?</DialogTitle>
            <DialogDescription>
              {props.childCount > 0
                ? `Has ${props.childCount} ${props.childCount === 1 ? 'child' : 'children'} — they'll move up to ${props.parentLabel ?? 'the top level'}. `
                : ''}
              Collection links to this node are removed. Its own values are kept with the deleted
              node.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <form action={deleteNodeAction.bind(null, props.nodeId)}>
              <SubmitButton variant="destructive">Delete</SubmitButton>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
