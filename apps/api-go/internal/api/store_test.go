package api

import "testing"

func TestNewStoreMemory(t *testing.T) {
	s := NewStore()
	if s == nil {
		t.Fatal("expected store")
	}
	if s.pg != nil {
		t.Log("postgres store optional; connected in this environment")
	}
}
