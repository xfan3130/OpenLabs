"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function NewExperimentDialog({
  datasetCount,
  onClose,
  onConfirm,
}: {
  datasetCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start a new experiment?</DialogTitle>
          <DialogDescription>
            This removes {datasetCount === 1 ? "the current dataset" : `all ${datasetCount} datasets`} and their analysis from
            this browser. Export anything you want to keep first.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} autoFocus>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Start new experiment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
